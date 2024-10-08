const createLog = require('../../logger/supabaseLogger');
const { supabaseCall } = require('../../supabaseWithRetry');
const supabase = require('../../supabaseClient');
const { getBearerDid } = require('./getBearerDid');
const { submitUserAction } = require("../../../util/bastion/endpoints/submitUserAction");
const { v4: uuidv4 } = require('uuid');
const { currencyContractAddress } = require("../../common/blockchain");
const { getMappedError } = require("../../../util/bastion/utils/errorMappings");
const { updateRequestRecord } = require("../../../util/transfer/cryptoToBankAccount/utils/updateRequestRecord")
const { erc20Transfer } = require("../../../util/bastion/utils/erc20FunctionMap");
const { pollYellowcardExchangeForOrder } = require('./pollYellowcardExchangeForOrder');

// Fetches offerings from a specific PFI and returns a selected offering based on currency pair.
async function executeYellowcardExchange(offrampTransactionRecord) {

	const { TbdexHttpClient, Order } = await import('@tbdex/http-client');
	const { data: yellowcardTransactionRecord, error: yellowcardTransactionError } = await supabase
		.from('yellowcard_transactions')
		.select('*')
		.eq('id', offrampTransactionRecord.yellowcard_transaction_id)
		.maybeSingle();

	if (yellowcardTransactionError || !yellowcardTransactionRecord) {
		console.error('Error fetching yellowcard transaction record:', yellowcardTransactionError);
		return { error: "An unexpected error occurred fetching transaction record." };
	}


	const bearerDid = await getBearerDid();

	const order = Order.create({
		metadata: {
			from: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.to,
			to: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.from,
			exchangeId: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.exchangeId,
			protocol: "1.0"
		}
	});

	await order.sign(bearerDid);

	try {
		await TbdexHttpClient.submitOrder(order);
	} catch (error) {
		console.error('Error submitting order:', error);
		await createLog("transfer/util/executeYellowcardExchange", offrampTransactionRecord.user_id, "Error submitting order", error);
		return { error: `Order submission failed: ${error.message}`, statusCode: error.statusCode };
	}

	const { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord } = await pollYellowcardExchangeForOrder(order, offrampTransactionRecord, bearerDid);

	return { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord };
}


module.exports = {
	executeYellowcardExchange
};