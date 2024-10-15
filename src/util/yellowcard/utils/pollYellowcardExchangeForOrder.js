const createLog = require('../../logger/supabaseLogger');
const { supabaseCall } = require('../../supabaseWithRetry');
const supabase = require('../../supabaseClient');
const { getBearerDid } = require('./getBearerDid');
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");
const { v4: uuidv4 } = require('uuid');
const { currencyContractAddress } = require("../../common/blockchain");
const { getMappedError } = require("../../bastion/utils/errorMappings");
const { updateRequestRecord } = require("../../transfer/cryptoToBankAccount/utils/updateRequestRecord")
const { erc20Transfer } = require("../../bastion/utils/erc20FunctionMap");
const { updateOfframpAndYellowcardRecords } = require('./updateOfframpAndYellowcardRecords');
const { currencyDecimal } = require("../../common/blockchain");
const { toUnitsString } = require("../../../util/transfer/cryptoToCrypto/utils/toUnits")


async function pollYellowcardExchangeForOrder(order, offrampTransactionRecord, bearerDid) {
	const { TbdexHttpClient } = await import('@tbdex/http-client');
	let orderClose;
	while (!orderClose) {
		try {
			const exchange = await TbdexHttpClient.getExchange({
				pfiDid: order.metadata.to,
				did: bearerDid,
				exchangeId: order.exchangeId
			});

			// return if order is closed
			orderClose = exchange.find(message => message.kind === 'close')
			if (orderClose) {
				// failed to get yellowcard order isntructions indicating failure of some kind on the yellowcard side
				console.log('**********close message:', orderClose)

				const offrampTransactionRecordToUpdate = {
					transaction_status: "NOT_INITIATED",
					failed_reason: "Order closed"
				};

				const yellowcardTransactionRecordToUpdate = {
					order_close_message: orderClose,
				}


				const { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord } = await updateOfframpAndYellowcardRecords(offrampTransactionRecord.id, offrampTransactionRecord.yellowcard_transaction_id, offrampTransactionRecordToUpdate, yellowcardTransactionRecordToUpdate)

				return { updatedOfframpTransactionRecord: updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord: updatedYellowcardTransactionRecord };
			}

			const orderInstructions = exchange.find(message => message.kind === 'orderinstructions')
			if (orderInstructions) {

				console.log('**********order instructions:', orderInstructions)

				const requestId = uuidv4();
				const payinLink = orderInstructions.data.payin.link;
				const urlParams = new URLSearchParams(new URL(payinLink).search);
				const yellowcardLiquidationWalletAddress = urlParams.get('walletAddress');

				// prepare the "amount" for the bastion submit user action call format
				const decimals = currencyDecimal[offrampTransactionRecord.source_currency]
				const transferAmount = toUnitsString(offrampTransactionRecord.amount, decimals)


				const bodyObject = {
					requestId: requestId,
					userId: offrampTransactionRecord.user_id,
					contractAddress: offrampTransactionRecord.contract_address,
					actionName: 'transfer',
					chain: offrampTransactionRecord.chain,
					actionParams: erc20Transfer(offrampTransactionRecord.source_currency, offrampTransactionRecord.chain, yellowcardLiquidationWalletAddress, transferAmount)
				};



				const bastionResponse = await submitUserAction(bodyObject);
				const bastionResponseBody = await bastionResponse.json();

				console.log('bastionResponseBody:', bastionResponseBody)
				if (!bastionResponse.ok) {
					// failed bastion user action
					console.log('failed bastion user action')

					await createLog("transfer/util/pollYellowcardExchangeForOrder", offrampTransactionRecord.user_id, "Error executing transfer", bastionResponseBody);


					const offrampTransactionRecordToUpdate = {
						bastion_response: bastionResponseBody,
						bastion_transaction_status: "FAILED",
						transaction_status: "NOT_INITIATED",
						failed_reason: bastionResponseBody.message,
					}

					const yellowcardTransactionRecordToUpdate = {
						order_instructions_message: orderInstructions,
						payin_wallet_address: yellowcardLiquidationWalletAddress,
					}


					const { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord } = await updateOfframpAndYellowcardRecords(offrampTransactionRecord.id, offrampTransactionRecord.yellowcard_transaction_id, offrampTransactionRecordToUpdate, yellowcardTransactionRecordToUpdate)



					return { updatedOfframpTransactionRecord: updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord: updatedYellowcardTransactionRecord };
				} else {

					// successful bastion user action
					console.log('successful bastion user action')

					const offrampTransactionRecordToUpdate = {
						bastion_response: bastionResponseBody,
						transaction_hash: bastionResponseBody.transactionHash,
						bastion_transaction_status: bastionResponseBody.status,
						transaction_status: bastionResponseBody.status == "FAILED" ? "NOT_INITIATED" : "SUBMITTED_ONCHAIN",
						failed_reason: bastionResponseBody.message,
					}

					const yellowcardTransactionRecordToUpdate = {
						order_instructions_message: orderInstructions,
						payin_wallet_address: yellowcardLiquidationWalletAddress,
					}


					const { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord } = await updateOfframpAndYellowcardRecords(offrampTransactionRecord.id, offrampTransactionRecord.yellowcard_transaction_id, offrampTransactionRecordToUpdate, yellowcardTransactionRecordToUpdate)

					return { updatedOfframpTransactionRecord: updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord: updatedYellowcardTransactionRecord };
				}

				return { offrampTransactionRecord: updatedOfframpTransactionRecord, yellowcardTransactionRecord: exchange };
			} else if (message instanceof Close) {
				// failed to get yellowcard order isntructions indicating failure of some kind on the yellowcard side
				console.log('**********close message:', message)

				const offrampTransactionRecordToUpdate = {
					transaction_status: "NOT_INITIATED",
					failed_reason: "Internal server error"
				};

				const yellowcardTransactionRecordToUpdate = {
					order_close_message: message,
				}


				const { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord } = await updateOfframpAndYellowcardRecords(offrampTransactionRecord.id, offrampTransactionRecord.yellowcard_transaction_id, offrampTransactionRecordToUpdate, yellowcardTransactionRecordToUpdate)

				return { updatedOfframpTransactionRecord: updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord: updatedYellowcardTransactionRecord };
			}
		}
		} catch (error) {
		console.error('Error during exchange processing:', error);
		await createLog("transfer/util/pollYellowcardExchangeForOrder", offrampTransactionRecord.user_id, "Exchange processing error", error);
		return { error: "Exchange process failed", details: error };
	}
}
}

module.exports = {
	pollYellowcardExchangeForOrder
};