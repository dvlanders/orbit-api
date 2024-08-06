const { rs, responseCode } = require("./index");
const { verifyToken } = require("../util/helper/verifyToken");
const supabase = require('./supabaseClient');
const { verifyUser } = require("./helper/verifyUser");
const { isUUID } = require("./common/fieldsValidation");
const { verifyApiKey } = require("./helper/verifyApiKey");
const { logger } = require('../util/logger/logger');
const readme = require('readmeio');
const { sendSlackMessage } = require('../util/logger/slackLogger');
const cloneDeep = require('lodash.clonedeep');
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
		// check userId
		if (userId && (!isUUID(userId) || !(await verifyUser(userId, keyInfo.profile_id)))) return res.status(401).json({ error: "Not authorized" });

		readme.log(README_API_KEY, req, res, {
			apiKey: apiKeyId,
			label: keyInfo.profile_id,
			email: keyInfo.profiles.email
		});

		req.query.profileId = keyInfo.profile_id
		req.query.profileEmail = keyInfo.profiles.email
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

	// don't log in test environment
	if (process.env.NODE_TEST) {
		console.log("logRequestResponse middleware disabled in test environment");
		return next();
	}
	console.log('logRequestResponse middleware triggered');

    // Create a deep copy of the req object
    const originalReq = cloneDeep({
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        body: req.body
    });

	const oldWrite = res.write;
	const oldEnd = res.end;
	const chunks = [];

	res.write = function (chunk) {
		chunks.push(chunk);
		return oldWrite.apply(res, arguments);
	};

	res.end = function (chunk) {
		if (chunk) {
			chunks.push(chunk);
		}
		const responseBody = Buffer.concat(chunks).toString('utf8');

		res.on('finish', () => {
			logger.info('Request and Response Details', {
				method: originalReq.method,
				route: originalReq.path,
				query: originalReq.query,
				params: originalReq.params,
				statusCode: res.statusCode,
				response: responseBody
			});
			const reqQuery = { ...originalReq.query };
			delete reqQuery.apiKeyId;
			const reqObject = {
				method: originalReq.method,
				route: originalReq.path,
				query: reqQuery,
				body: originalReq.body,
				params: originalReq.params
			}
			const resObject = {
				statusCode: res.statusCode,
				body: responseBody
			}


			//define list of emails where we dont want to send slack message
			const excludedEmails = [
				"test@gmail.com",
				"willyyang.521@gmail.com",
				"wy323@cornell.edu",
				"sam@hifibridge.com",
				"samyoon940@gmail.com"
			]


			if (!excludedEmails.includes(reqObject.query.profileEmail)) {
				sendSlackMessage(reqObject, resObject);
			}

		});

		oldEnd.apply(res, arguments);
	};

	next();
};