const supabase = require("../../../src/util/supabaseClient")
const areObjectsEqual = require("../../utils/configCompare")

exports.executeBlindpayPayoutScheduleCheck = async (job, config, userId) => {

	const { data, error } = await supabase
		.from("jobs_queue")
		.select("*")
		.eq("job", job)
		.eq("user_id", userId)
		.order("created_at", { ascending: false })

	if (!data || data.length <= 0) return true
	for (const record of data) {
		if (areObjectsEqual(record.config, config)) return false
	}

	return true
}