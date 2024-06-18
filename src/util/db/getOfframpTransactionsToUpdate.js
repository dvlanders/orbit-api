const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const createLog = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry")
const { BridgeCustomerStatus } = require("../utils");



exports.getOfframpTransactionsToUpdate = async (

) => {
	// query the offramp_transactions table for all records where the bastion_transaction_status is not COMPLETED or FAILED_ONCHAIN

	// get the list of bastion transac
	const { data: userKyc, error: userKycError } = await supabaseCall(() => supabase
		.from("offramp_transactions")
		.select('id')
		.neq('bastion_transaction_status', 'COMPLETED')
		.neq('bastion_transaction_status', 'FAILED_ONCHAIN')
		// TODO: add the FAILED_ON_FIAT status once that exists


	);



	// ma

}