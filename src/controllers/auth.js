const { createClient } = require("@supabase/supabase-js");
const { createApiKeyFromProvider } = require("../util/auth/createApiKey/createZuploApiKey");
const { fieldsValidation } = require("../util/common/fieldsValidation");
const { verifyToken } = require("../util/helper/verifyToken");
const createLog = require("../util/logger/supabaseLogger");
const { supabaseCall } = require("../util/supabaseWithRetry");
const activateWebhook = require("../util/auth/webhook/createWebhookUrl");
const supabase = require("../util/supabaseClient");
const supabaseSandbox = require("../util/sandboxSupabaseClient");

exports.createApiKey = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	let profileId

	try {
		// // this token will be supabase auth token
		const token = req.headers.authorization?.split(" ")[1];
		if (!token) {
			return res.status(401).json({ error: "Not authorized" });
		}

		// get user info (user_id)
		const user = await verifyToken(token);
		if (!user || !user.sub) {
			return res.status(401).json({ error: "Not authorized" });
		}
		profileId = user.sub;

		const fields = req.body;
		const { apiKeyName, expiredAt, env } = fields;

		const getProfile = async (supabaseClient, profileId) => {
			const { data, error } = await supabaseCall(() => supabaseClient
				.from("profiles")
				.select("*, organization: organization_id(*)")
				.eq("id", profileId)
				.maybeSingle());
			if (error) throw error;
			return data;
		};

		let organizationId

		if (env === "production") {
			const profile = await getProfile(supabase, profileId);
			if (!profile.organization.prod_enabled) {
				return res.status(401).json({ error: "Please contact HIFI for activating the production environment" });
			}
			organizationId = profile.organization_id
		}

		if (env === "sandbox") {
			let sandboxProfile = await getProfile(supabaseSandbox, profileId);
			if (!sandboxProfile) {
				// insert sandbox profile
				const prodProfile = await getProfile(supabase, profileId);
				if (!prodProfile) {
					return res.status(404).json({ error: "Production profile not found" });
				}
				// delete extra information before insert
				delete prodProfile.organization

				const { data: newSandboxProfile, error: newSandboxProfileError } = await supabaseCall(() => supabaseSandbox
					.from("profiles")
					.insert(prodProfile));
				if (newSandboxProfileError) throw newSandboxProfileError;
				organizationId = prodProfile.organization_id
			}else{
				organizationId = sandboxProfile.organization_id
			}
		}

		// field validation
		const { missingFields, invalidFields } = fieldsValidation(fields, ["apiKeyName", "expiredAt", "env"], { "apiKeyName": "string", "expiredAt": "string", "env": "string" });
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `Fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields });

		const apikeyInfo = await createApiKeyFromProvider(organizationId, apiKeyName, expiredAt, env);
		return res.status(200).json(apikeyInfo);

	} catch (error) {
		console.error(error);
		await createLog("auth/createApiKey", null, error.message, error, profileId);
		return res.status(500).json({ error: "Internal server error" });
	}

}

exports.getApiKey = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	let profileId

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

		profileId = user.sub
		//get profile and organization
		const { data: profile, error: profileError } = await supabase
			.from("profiles")
			.select("organization_id, organization: organization_id(*)")
			.eq("id", profileId)
			.maybeSingle()

		if (profileError) throw profileError

		// get from sandbox
		let { data: sandboxKeys, error: sandboxKeysError } = await supabaseSandbox
			.from("api_keys")
			.select()
			.eq("profile_id", profile.organization_id)
			.is("active", true)

		if (sandboxKeysError) throw sandboxKeysError
		sandboxKeys = sandboxKeys.map((key) => {
			return {
				...key,
				env: "sandbox"
			}
		})

		// get from production
		let { data: prodKeys, error: prodKeysError } = await supabase
			.from("api_keys")
			.select()
			.eq("profile_id", profile.organization_id)
			.is("active", true)

		if (prodKeysError) throw prodKeysError
		prodKeys = prodKeys.map((key) => {
			return {
				...key,
				env: "production"
			}
		})

		const keys = [...prodKeys, ...sandboxKeys]
		keys.sort((a, b) => {
			const dateA = new Date(a.created_at);
			const dateB = new Date(b.created_at);

			return dateB.getTime() - dateA.getTime();
		});

		return res.status(200).json({ keys })

	} catch (error) {
		await createLog("auth/getApiKey", null, error.message, error, profileId)
		return res.status(500).json({ error: "Internal server error" })
	}
}

// exports.createProfileInSandbox = async (req, res) => {
// 	if (req.method !== 'POST') {
// 		return res.status(405).json({ error: 'Method not allowed' });
// 	}
// 	const { record } = req.body
// 	if (!record) return res.status(400).json({ error: 'record required' });
// 	try {
// 		const supabase = createClient(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY)
// 		// insert new profile
// 		const { data, error } = await supabaseCall(() => supabase
// 			.from("profiles")
// 			.insert({
// 				id: record.id
// 			}))
// 		if (error) throw error
// 		return res.status(200).json({ message: "sandbox profiles create successfully" })

// 	} catch (error) {
// 		await createLog("auth/createProfileInSandbox", null, `Fail to create sandbox profile for: ${record.id}`, error)
// 		return res.status(500).json({ error: "Unexpected error happened" })
// 	}
// }

exports.createWebhook = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	let profileId
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

		profileId = user.sub
		let organizationId

		const { webhookUrl, env } = req.body
		// filed validation
		if (!webhookUrl || !env) return res.status(400).json({ error: "webhookUrl and env is required" })

		const getProfile = async (supabaseClient, profileId) => {
			const { data, error } = await supabaseCall(() => supabaseClient
				.from("profiles")
				.select("*, organization: organization_id(*)")
				.eq("id", profileId)
				.maybeSingle());
			if (error) throw error;
			return data;
		};

		if (env === "production") {
			const profile = await getProfile(supabase, profileId);
			if (!profile.organization.prod_enabled) {
				return res.status(401).json({ error: "Please contact HIFI for activating the production environment" });
			}
			organizationId = profile.organization_id
		}

		if (env === "sandbox") {
			const sandboxProfile = await getProfile(supabaseSandbox, profileId);

			if (!sandboxProfile) {
				// insert sandbox profile
				const prodProfile = await getProfile(supabase, profileId);
				if (!prodProfile) {
					return res.status(404).json({ error: "Production profile not found" });
				}
				// delete extra information before insert
				delete prodProfile.organization

				const { data: newSandboxProfile, error: newSandboxProfileError } = await supabaseCall(() => supabaseSandbox
					.from("profiles")
					.insert(prodProfile));
				if (newSandboxProfileError) throw newSandboxProfileError;
				organizationId = prodProfile.organization_id
			}else{
				organizationId = sandboxProfile.organization_id
			}
		}

		const secretKey = await activateWebhook(webhookUrl, organizationId, env)
		const result = {
			webhookUrl,
			secretKey
		}
		return res.status(200).json(result)

	} catch (error) {
		console.error(error)
		await createLog("auth/createWebhook", null, error.message, error, profileId)
		return res.status(500).json({ error: "Internal server error" })
	}
}

exports.getWebhook = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	let profileId
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

		profileId = user.sub
		//get profile and organization
		const { data: profile, error: profileError } = await supabase
			.from("profiles")
			.select("organization_id, organization: organization_id(*)")
			.eq("id", profileId)
			.maybeSingle()

		if (profileError) throw profileError

		
		const webhookInfo = {
			production: {
				webhookUrl: "",
				webhookSecret: ""
			},
			sandbox: {
				webhookUrl: "",
				webhookSecret: ""
			}
		}
		// get from sandbox
		const { data: sandboxWebhook, error: sandboxWebhookError } = await supabaseSandbox
			.from("webhook_urls")
			.select()
			.eq("profile_id", profile.organization_id)
			.maybeSingle()

		if (sandboxWebhookError) throw sandboxWebhookError
		if (sandboxWebhook) {
			webhookInfo.sandbox.webhookUrl = sandboxWebhook.webhook_url
			webhookInfo.sandbox.webhookSecret = sandboxWebhook.webhook_secret
		}

		// get from production
		const { data: prodWebhook, error: prodWebhookError } = await supabase
			.from("webhook_urls")
			.select()
			.eq("profile_id", profile.organization_id)
			.maybeSingle()

		if (prodWebhookError) throw prodWebhookError
		if (prodWebhook) {
			webhookInfo.production.webhookUrl = prodWebhook.webhook_url
			webhookInfo.production.webhookSecret = prodWebhook.webhook_secret
		}

		return res.status(200).json(webhookInfo)

	} catch (error) {
		await createLog("auth/getWebhook", null, error.message, error, profileId)
		return res.status(500).json({ error: "Internal server error" })
	}
}