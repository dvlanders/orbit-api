const { rs, responseCode } = require("./index");
const { verifyToken } = require("../util/helper/verifyToken");
const supabase = require('./supabaseClient');
const { verifyUser } = require("./helper/verifyUser");
const { isUUID } = require("./common/fieldsValidation");
const { verifyApiKey } = require("./helper/verifyApiKey");
const { logger } = require('../util/logger/logger');
const readme = require('readmeio');
const { sendSlackReqResMessage } = require('../util/logger/slackLogger');
const cloneDeep = require('lodash.clonedeep');
const createLog = require("./logger/supabaseLogger");
const { isUserFrozen } = require("./internal/user/checkIsUserFrozen");
const SECRET = process.env.ZUPLO_SECRET
const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET
const README_API_KEY = process.env.README_API_KEY
// /**
//  * @description Middleware to protect routes by verifying JWT token.
//  * @param {Object} req - Express request object.
//  * @param {Object} res - Express response object.
//  * @param {Function} next - Express next function.
//  * @returns
//  */
exports.authorize = async (req, res, next) => {
	try {
		const { userId, apiKeyId } = req.query
		// check api key provider secret
		const token = req.headers['zuplo-secret'];
		if (!token) return res.status(401).json({ error: "Not authorized" });
		if (token !== SECRET) return res.status(401).json({ error: "Not authorized" });
		// check api key id
		if (!apiKeyId) return res.status(401).json({ error: "Not authorized" });
		// get keyInfo
		const keyInfo = await verifyApiKey(apiKeyId)
		if (!keyInfo) return res.status(401).json({ error: "Invalid api key" });
		if (!keyInfo.profiles.prod_enabled && process.env.NODE_ENV !== "development") return res.status(401).json({ error: "Production access is not enabled. Please contact HIFI for more information." });
		// check userId
		if (userId && (!isUUID(userId) || !(await verifyUser(userId, keyInfo.profile_id)))) return res.status(401).json({ error: "userId not found" });

		readme.log(README_API_KEY, req, res, {
			apiKey: apiKeyId,
			label: keyInfo.profile_id,
			email: keyInfo.profiles.email
		});

		req.query.profileId = keyInfo.profile_id
		req.query.profileEmail = keyInfo.profiles.email
		if (await isUserFrozen(req.query.profileId, req.path)) return res.status(401).json({ error: "Not authorized for this route. Please contact HIFI for more information." });
		next();
	} catch (err) {
		console.error(err)
		return res.status(500).json({ error: "Unexpected error happened" });
	}
};


exports.authorizeDashboard = async (req, res, next) => {
	try {
		// this token will be supabase auth token
		const token = req.headers.authorization?.split(" ")[1];
		if (!token) {
			return res.status(401).json({ error: "Not authorized" });
		};

		// get user info (user_id)
		const user = await verifyToken(token);
		if (!user && !user?.sub) {
			return res.status(401).json({ error: "Not authorized" });
		};

		//check is prod enable
		const { data, error } = await supabase
			.from("profiles")
			.select("organization_id, organization_role, organization: organization_id(*), email")
			.eq("id", user.sub)
			.maybeSingle()

		if (error) throw error
		if (!data || !data.organization) return res.status(401).json({ error: "Not authorized" });
		// if (!data.organization.prod_enabled) return res.status(401).json({ error: "Not authorized" });

		req.query.profileId = data.organization_id // customers's organization id
		req.query.profileEmail = data.email
		req.query.originProfileId = user.sub // customers's profile id
		req.organization = {
			prodEnabled: data.organization.prod_enabled,
			organizationRole: data.organization_role
		}
		if (await isUserFrozen(req.query.profileId, req.path)) return res.status(401).json({ error: "Not authorized for this route. Please contact HIFI for more information." });
		next()
	} catch (error) {
		console.error(error)
		return res.status(500).json({ error: "Unexpected error happened" });
	}
}

exports.requiredAdmin = async (req, res, next) => {
	try {
		if (req.organization.organizationRole != "ADMIN") return res.status(401).json({ error: "Not authorized" });
		next()
	} catch (error) {
		console.error(error)
		return res.status(500).json({ error: "Unexpected error happened" });
	}
}

exports.requiredProdDashboard = async (req, res, next) => {
	try {
		if (!req.organization.prodEnabled) return res.status(401).json({ error: "Not authorized" });
		next()
	} catch (error) {
		console.error(error)
		return res.status(500).json({ error: "Unexpected error happened" });
	}
}


exports.logRequestResponse = (req, res, next) => {
	if (process.env.NODE_TEST) {
		console.log("logRequestResponse middleware disabled in test environment");
		return next();
	}

	const originalReq = cloneDeep({
		method: req.method,
		path: req.path,
		query: req.query,
		params: req.params,
		body: req.body
	});

	const originalSend = res.send;
	// Override send function
	res.send = function (body) {

		let parsedBody;
		try {
			parsedBody = JSON.parse(body);
		} catch (e) {
			parsedBody = body;
		}

		const filteredQuery = { ...originalReq.query };
		delete filteredQuery.apiKeyId;

		const logData = {
			method: originalReq.method,
			path: originalReq.path,
			query: filteredQuery,
			params: originalReq.params,
			body: originalReq.body,
			statusCode: res.statusCode,
			response: parsedBody
		};

		if(res.errorMessage){
			logData.error = res.errorMessage;
		}

		logToLoki(logData);

		const reqObject = {
			method: originalReq.method,
			route: originalReq.path,
			query: filteredQuery,
			body: originalReq.body,
			params: originalReq.params
		}
		const resObject = {
			statusCode: res.statusCode,
			body: parsedBody
		}
		//define list of emails where we dont want to send slack message
		const excludedEmails = [
			"test@gmail.com",
			"willyyang.521@gmail.com",
			"wy323@cornell.edu",
			"sam@hifibridge.com",
			"samyoon940@gmail.com",
			"samyoon941@gmail.com",
			"william.yang@hifibridge.com"
		]

		//define list of endpoints to exclude from slack message
		const excludedEndpoints = [
			{ method: "GET", route: "/auth/apiKey" },
			{ method: "GET", route: "/auth/webhook" },
		]

		if (!excludedEmails.includes(reqObject.query.profileEmail) &&
			!excludedEndpoints.some(endpoint => endpoint.method === reqObject.method && endpoint.route === reqObject.route) &&
			res.statusCode !== 200) {
			sendSlackReqResMessage(reqObject, resObject);
		}


		originalSend.call(this, body);
	};
	next();
};


function logToLoki(message) {

	const logEntry = {
		streams: [{
			stream: {
				app: `hifi-api-${process.env.NODE_ENV}`,
				source: 'logToLoki middleware',
				profileEmail: message.query.profileEmail,
				path: message.path,
			},
			values: [
				[`${Date.now() * 1e6}`, JSON.stringify(message, null, 2)]
			]
		}]
	};


	fetch(`${process.env.GRAFANA_LOKI_PUSH_URL}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Basic ${Buffer.from(`${process.env.GRAFANA_USER_ID}` + ':' + `${process.env.GRAFANA_API_KEY}`).toString('base64')}`
		},
		body: JSON.stringify(logEntry)
	})
		.then(response => {
			if (!response.ok) {
				console.error(`HTTP Error Response: ${response.status} ${response.statusText}`);
				return response.text().then(text => {
					throw new Error(text);
				});
			}
			if (response.status === 204) {
				console.log('Log sent successfully: No Content');
				return;
			}
			return response.text().then(text => {
				try {
					return JSON.parse(text);
				} catch {
					return text;
				}
			});
		})
		.then(data => {
			if (data) {
				console.log('Log sent successfully:', data);
			}
		})
		.catch(err => {
			console.error('Error sending logs to Loki:', err);
		});
}

exports.localAdmin = async (req, res, next) => {
	try {
		const { userId, profileId } = req.query
		if (!profileId) return res.status(400).jsno({ error: "profileId is required" })
		if (userId && (!isUUID(userId) || !(await verifyUser(userId, profileId)))) return res.status(401).json({ error: "userId not found or not under provided profileId" });

		next()
	} catch (error) {
		await createLog("middleware/localAdmin", null, error.message, error)
		return res.status(500).json({ error: "Internal server error" })
	}
}
