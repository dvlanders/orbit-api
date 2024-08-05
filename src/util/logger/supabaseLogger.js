const supabase = require("../supabaseClient");

async function createLog(source, userId, log, response, profileId = null) {
	// don't log in test environment
	if (process.env.NODE_TEST) {
		console.log("Logging disabled in test environment");
		return;
	}

	if (process.env.DISABLE_LOGGING.toUpperCase() === 'TRUE') {
		console.log("Logging disabled via DISABLE_LOGGING environment variable.");
		return;
	}

	const newLog = {
		source: source,
		log: log,
		response: response,
	};

	if (userId) {
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select(
				"profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)"
			)
			.eq("id", userId)
			.single();

		if (userError || !userData) {
			throw new Error("Failed to fetch user data");
		}

		newLog.user_id = userId;
		newLog.user_identifier =
			userData.user_kyc && userData.user_kyc.length > 0
				? `${userData.user_kyc[0].legal_first_name} ${userData.user_kyc[0].legal_last_name} ${userData.user_kyc[0].business_name} ${userData.user_kyc[0].compliance_email}`
				: null;
		newLog.profile_id = profileId;
		newLog.profile_id = userData.profile_id;
	} else if (profileId) {
		newLog.profile_id = profileId;
	}

	const { data, error } = await supabase.from("logs").insert(newLog);
}

module.exports = createLog;