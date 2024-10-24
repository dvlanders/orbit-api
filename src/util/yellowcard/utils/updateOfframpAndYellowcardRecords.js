const createLog = require('../../logger/supabaseLogger');
const { supabaseCall } = require('../../supabaseWithRetry');
const supabase = require('../../supabaseClient');


// Fetches offerings from a specific PFI and returns a selected offering based on currency pair.
async function updateOfframpAndYellowcardRecords(offrampTransactionRecordId, yellowcardTransactionRecordId, offrampTransactionRecordBodyForUpdate, yellowcardTransactionRecordBodyForUpdate) {
	try {
		const { data: updatedOfframpTransactionRecord, error: updateError } = await supabase
			.from('offramp_transactions')
			.update(offrampTransactionRecordBodyForUpdate)
			.eq('id', offrampTransactionRecordId)
			.select()
			.maybeSingle();

		if (updateError) {
			console.log('updateError:', updateError);
			throw new Error(`Error updating offramp transaction record: ${updateError.message}`);
		}

		const { data: updatedYellowcardTransactionRecord, error: updateYellowcardError } = await supabase
			.from('yellowcard_transactions')
			.update(yellowcardTransactionRecordBodyForUpdate)
			.eq('id', yellowcardTransactionRecordId)
			.select()
			.maybeSingle();

		if (updateYellowcardError) {
			console.log('updateYellowcardError:', updateYellowcardError);
			throw new Error(`Error updating yellowcard transaction record: ${updateYellowcardError.message}`);
		}


		return { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord };
	} catch (error) {
		console.error("Caught Error:", error);
		await createLog("transfer/util/updateOfframpAndYellowcardRecords", null, "Error in updating records", error);
		return { error: error.message };
	}
}




module.exports = {
	updateOfframpAndYellowcardRecords
}