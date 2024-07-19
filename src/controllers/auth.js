const { createClient } = require("@supabase/supabase-js");
const { createApiKeyFromProvider } = require("../util/auth/createApiKey/createZuploApiKey");
const { fieldsValidation } = require("../util/common/fieldsValidation");
const { verifyToken } = require("../util/helper/verifyToken");
const createLog = require("../util/logger/supabaseLogger");
const { supabaseCall } = require("../util/supabaseWithRetry");
const activateWebhook = require("../util/auth/webhook/createWebhookUrl");
const supabase = require("../util/supabaseClient");

exports.createApiKey = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

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
		const profileId = user.sub


		const fields = req.body
		const { apiKeyName, expiredAt, env } = fields

		const createClientInstance = (url, key) => createClient(url, key);
		const getProfile = async (supabase, profileId) => {
			const { data, error } = await supabaseCall(() => supabase
				.from("profiles")
				.select("*")
				.eq("id", profileId)
				.maybeSingle());
			if (error) throw error;
			return data;
		};

		if (env === "production") {
			const supabase = createClientInstance(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
			const profile = await getProfile(supabase, profileId);
			if (!profile.prod_enabled) {
				return res.status(401).json({ error: "Please contact HIFI for activating the production environment" });
			}
		}

		if (env === "sandbox") {
			const sandboxSupabase = createClientInstance(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY);
			let sandboxProfile = await getProfile(sandboxSupabase, profileId);

			if (!sandboxProfile) {
				const prodSupabase = createClientInstance(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
				const prodProfile = await getProfile(prodSupabase, profileId);

				if (!prodProfile) {
					return res.status(404).json({ error: "Production profile not found" });
				}

				const { id, ...rest } = prodProfile;
				const { data: newSandboxProfile, error: newSandboxProfileError } = await supabaseCall(() => sandboxSupabase
					.from("profiles")
					.insert({
						id: profileId,
						...rest
					}));
				if (newSandboxProfileError) throw newSandboxProfileError;
			}
		}


		// filed validation
		const { missingFields, invalidFields } = fieldsValidation(fields, ["apiKeyName", "expiredAt", "env"], { "apiKeyName": "string", "expiredAt": "string", "env": "string" })
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })


		const apikeyInfo = await createApiKeyFromProvider(profileId, apiKeyName, expiredAt, env)
		return res.status(200).json(apikeyInfo)

	} catch (error) {
		console.error(error)
		createLog("auth/createApiKey", "", error.message, error)
		return res.status(500).json({ error: "Internal server error" })
	}

}

exports.getApiKey = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

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

		const profileId = user.sub

		// get from sandbox
		let supabase = createClient(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY)
		let { data: sandboxKeys, error: sandboxKeysError } = await supabase
			.from("api_keys")
			.select()
			.eq("profile_id", profileId)
			.is("active", true)

		if (sandboxKeysError) throw sandboxKeysError
		sandboxKeys = sandboxKeys.map((key) => {
			return {
				...key,
				env: "sandbox"
			}
		})

		// get from production
		supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
		let { data: prodKeys, error: prodKeysError } = await supabase
			.from("api_keys")
			.select()
			.eq("profile_id", profileId)
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
		createLog("auth/getWebhook", "", error.message)
		return res.status(500).json({ error: "Internal server error" })
	}
}


exports.createProfileInSandbox = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	try {
		const supabase = createClient(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY)
		// insert new profile
		const { record } = req.body
		const { data, error } = await supabaseCall(() => supabase
			.from("profiles")
			.insert({
				id: record.id
			}))
		if (error) throw error
		return res.status(200).json({ message: "sandbox profiles create successfully" })

	} catch (error) {
		createLog("auth/createProfileInSandbox", "", `Fail to create profile for: ${record.id}, ${error.message}`)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}

exports.createWebhook = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

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

		const profileId = user.sub
		const { webhookUrl, env } = req.body
		// filed validation
		if (!webhookUrl || !env) return res.status(400).json({ error: "webhookUrl and env is required" })

		const createClientInstance = (url, key) => createClient(url, key);
		const getProfile = async (supabase, profileId) => {
			const { data, error } = await supabaseCall(() => supabase
				.from("profiles")
				.select("*")
				.eq("id", profileId)
				.maybeSingle());
			if (error) throw error;
			return data;
		};

		if (env === "production") {
			const supabase = createClientInstance(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
			const profile = await getProfile(supabase, profileId);
			if (!profile.prod_enabled) {
				return res.status(401).json({ error: "Please contact HIFI for activating the production environment" });
			}
		}

		if (env === "sandbox") {
			const sandboxSupabase = createClientInstance(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY);
			let sandboxProfile = await getProfile(sandboxSupabase, profileId);

			if (!sandboxProfile) {
				const prodSupabase = createClientInstance(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
				const prodProfile = await getProfile(prodSupabase, profileId);

				if (!prodProfile) {
					return res.status(404).json({ error: "Production profile not found" });
				}

				console.log('prod profile', prodProfile);

				const { id, ...rest } = prodProfile;
				const { data: newSandboxProfile, error: newSandboxProfileError } = await supabaseCall(() => sandboxSupabase
					.from("profiles")
					.insert({
						id: profileId,
						...rest
					}));
				if (newSandboxProfileError) throw newSandboxProfileError;
			}
		}

		const secretKey = await activateWebhook(webhookUrl, profileId, env)
		const result = {
			webhookUrl,
			secretKey
		}
		return res.status(200).json(result)

	} catch (error) {
		console.error(error)
		createLog("auth/createWebhookUrl", "", error.message, error)
		return res.status(500).json({ error: "Internal server error" })
	}
}

exports.getWebhook = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

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

		const profileId = user.sub
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
		let supabase = createClient(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY)
		const { data: sandboxWebhook, error: sandboxWebhookError } = await supabase
			.from("webhook_urls")
			.select()
			.eq("profile_id", profileId)
			.maybeSingle()

		if (sandboxWebhookError) throw sandboxWebhookError
		if (sandboxWebhook) {
			webhookInfo.sandbox.webhookUrl = sandboxWebhook.webhook_url
			webhookInfo.sandbox.webhookSecret = sandboxWebhook.webhook_secret
		}

		// get from production
		supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
		const { data: prodWebhook, error: prodWebhookError } = await supabase
			.from("webhook_urls")
			.select()
			.eq("profile_id", profileId)
			.maybeSingle()

		if (prodWebhookError) throw prodWebhookError
		if (prodWebhook) {
			webhookInfo.production.webhookUrl = prodWebhook.webhook_url
			webhookInfo.production.webhookSecret = prodWebhook.webhook_secret
		}

		return res.status(200).json(webhookInfo)

	} catch (error) {
		createLog("auth/getWebhook", "", error.message)
		return res.status(500).json({ error: "Internal server error" })
	}
}