const supabase = require("../supabaseClient");
const { sendSlackLogMessage } = require("./slackLogger");

async function createLog(source, userId, log, response, profileId = null, res = null) {
	// don't log in test environment
	if (process.env.NODE_TEST) {
		console.log("Logging disabled in test environment");
		return;
	}

	const newLog = {
		source: source,
		log: log,
		response: response,
	};

	if(res){
		res.errorMessage = {...newLog};
	}

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

	let logTableName = "logs"
	if (process.env.DEV_LOGGING && process.env.DEV_LOGGING.toUpperCase() === 'TRUE') {
		// log to dev table if is 
		logTableName = "dev_logs"
		newLog.log_origin = process.env.LOG_ORIGIN || "LOCAL"
		console.log(`
			=== Error Log ===
			Source: ${source}
			User ID: ${userId || "N/A"}
			Log: ${log}
			Response: ${response}
			Profile ID: ${profileId || "N/A"}
			=================
		`);
	}
	const { data: logData, error: logError } = await supabase.from(logTableName).insert(newLog).select().single();

	if (logError) throw new Error("Failed to insert new log");

	if (process.env.DEV_LOGGING && process.env.DEV_LOGGING.toUpperCase() === 'TRUE')return;

	let parsedResponse;
	try {
		parsedResponse = JSON.parse(logData.response);
	} catch (error) {
		parsedResponse = logData.response;
	}
	await sendSlackLogMessage(logData.profile_email, logData.user_email, logData.source, logData.log, parsedResponse)
}

module.exports = createLog;