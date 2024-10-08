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


// Fetches offerings from a specific PFI and returns a selected offering based on currency pair.
async function executeYellowcardExchange(yellowcardTransactionId) {
	const { TbdexHttpClient, Order, OrderStatus, OrderInstructions, Close, Message } = await import('@tbdex/http-client');

	const { data: yellowcardTransactionRecord, error: yellowcardTransactionError } = await supabaseCall(() => supabase
		.from('yellowcard_transactions')
		.select('*')
		.eq('id', yellowcardTransactionId)
		.maybeSingle());

	if (yellowcardTransactionError || !yellowcardTransactionRecord) {
		console.error('Error fetching yellowcard transaction record:', yellowcardTransactionError);
		return { error: "An unexpected error occurred fetching transaction record." };
	}

	// Retrieve the associated offramp transaction record
	const { data: offrampTransaction, error: offrampError } = await supabase.from('offramp_transactions')
		.select('*')
		.eq('yellowcard_transaction_id', yellowcardTransactionId)
		.maybeSingle();

	if (offrampError || !offrampTransaction) {
		console.error('Error fetching offramp transaction:', offrampError);
		return { error: "An unexpected error occurred fetching offramp transaction." };
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
		await createLog("transfer/util/executeYellowcardExchange", offrampTransaction.user_id, "Error submitting order", error);
		return { error: `Order submission failed: ${error.message}`, statusCode: error.statusCode };
	}

	let orderClose;

	while (!orderClose) {
		try {
			const exchange = await TbdexHttpClient.getExchange({
				pfiDid: order.metadata.to,
				did: bearerDid,
				exchangeId: order.exchangeId
			});

			for (const message of exchange) {
				if (message instanceof OrderInstructions) {
					const requestId = uuidv4();
					const payinLink = message.data.payin.link;
					const urlParams = new URLSearchParams(new URL(payinLink).search);
					const yellowcardLiquidationWalletAddress = urlParams.get('walletAddress');


					const bodyObject = {
						requestId: requestId,
						userId: offrampTransaction.user_id,
						contractAddress: offrampTransaction.contract_address,
						actionName: 'transfer',
						chain: offrampTransaction.chain,
						actionParams: erc20Transfer(offrampTransaction.source_currency, offrampTransaction.chain, yellowcardLiquidationWalletAddress, offrampTransaction.amount)
					};

					const bastionResponse = await submitUserAction(bodyObject);
					const bastionResponseBody = await bastionResponse.json();


					if (!bastionResponse.ok) {
						console.error('Error executing transfer:', bastionResponseBody);
						await createLog("transfer/util/executeYellowcardExchange", offrampTransaction.user_id, "Error executing transfer", bastionResponseBody);

						const toUpdate = {
							bastion_response: bastionResponseBody,
							bastion_transaction_status: "FAILED",
							transaction_status: "NOT_INITIATED",
							failed_reason: message
						}

						await updateRequestRecord(initialTransferRecord.id, toUpdate)
					} else {

						const toUpdate = {
							bastion_response: bastionResponseBody,
							transaction_hash: bastionResponseBody.transactionHash,
							bastion_transaction_status: bastionResponseBody.status,
							transaction_status: bastionResponseBody.status == "FAILED" ? "NOT_INITIATED" : "SUBMITTED_ONCHAIN",
							failed_reason: bastionResponseBody.failureDetails,
						}
						await updateRequestRecord(initialTransferRecord.id, toUpdate)
					}
					return updateData;
				} else if (message instanceof Close) {
					const requestId = uuidv4();
					const toUpdate = {
						transaction_status: "NOT_INITIATED",
						failed_reason: "Order closed"
					};
					await updateRequestRecord(offrampTransaction.id, toUpdate);
					orderClose = true;
					return toUpdate;
				}
			}
		} catch (error) {
			console.error('Error during exchange processing:', error);
			await createLog("transfer/util/executeYellowcardExchange", offrampTransaction.user_id, "Exchange processing error", error);
			return { error: "Exchange process failed", details: error };
		}
	}
}

module.exports = {
	executeYellowcardExchange
};
