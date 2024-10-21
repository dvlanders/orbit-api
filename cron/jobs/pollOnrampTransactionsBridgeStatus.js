// const supabase = require("../../src/util/supabaseClient");
// const { supabaseCall } = require("../../src/util/supabaseWithRetry");
// const createLog = require('../../src/util/logger/supabaseLogger');
// const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
// const notifyFiatToCryptoTransfer = require("../../webhooks/transfer/notifyFiatToCryptoTransfer");
// const { BridgeTransactionStatusMap } = require("../../src/util/bridge/utils");
// const { chargeFeeOnFundReceivedScheduleCheck } = require("../../asyncJobs/transfer/chargeFeeOnFundReceivedBastion/scheduleCheck");
// const createJob = require("../../asyncJobs/createJob");
// const notifyTransaction = require("../../src/util/logger/transactionNotifier");
// const { updateBridgeTransactionRecord } = require("../../src/util/bridge/bridgeTransactionTableService");
// const { rampTypes } = require("../../src/util/transfer/utils/ramptType");
// const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
// const BRIDGE_URL = process.env.BRIDGE_URL;

// const updateStatus = async (onrampTransaction) => {
// 	try {
// 		const checkbookTransactionInfo = onrampTransaction.checkbook_transaction_info;
// 		const bridgeTransactionInfo = onrampTransaction.bridge_transaction_info;
// 		if (!bridgeTransactionInfo.bridge_deposit_id) return;

// 		// fetch up to 100 actvity of this account until no more records after the last_bridge_virtual_account_event_id
// 		// or the transaction status is final
// 		let last_event_id = bridgeTransactionInfo.last_bridge_virtual_account_event_id
// 		while (true) {
// 			const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeTransactionInfo.bridge_user_id}/virtual_accounts/${bridgeTransactionInfo.bridge_virtual_account_id}/history?limit=100&${last_event_id ? `ending_before=${last_event_id}` : ""}`, {
// 				method: 'GET',
// 				headers: {
// 					'Api-Key': BRIDGE_API_KEY
// 				}
// 			});

// 			const responseBody = await response.json();
// 			if (!response.ok) {
// 				await createLog('pollOnrampTransactionsBridgeStatus', onrampTransaction.user_id, 'Failed to fetch response from bridge', responseBody);
// 				return
// 			}

// 			// no activity
// 			if (responseBody.data <= 0) {
// 				break
// 			}
// 			const events = responseBody.data
// 			last_event_id = events[0].id

// 			// "description": "INDIVIDUAL Checkbook Inc [75D7C01F 5F93 4490 8B9] CHECK 5006 WILLIAM YANG 312410A2 9C1B 4337 AFEB 71DAD9DA3428"
// 			// try to find the latest record
// 			for (const event of events) {
// 				if(event.type === "funds_scheduled" || event.type === "microdeposit") continue

// 				const description = event.source.description
// 				const referenceId = description?.split(" ")?.slice(-5)?.join('-')?.toLowerCase()
// 				const depositId = event.deposit_id;
// 				const hasDepositId = depositId == bridgeTransactionInfo.bridge_deposit_id
// 				const hasReferenceId = referenceId == onrampTransaction.id

// 				if(hasDepositId || hasReferenceId){

// 					const { data: updatedOnrampRecord, error: updateError } = await supabase
// 					.from("onramp_transactions")
// 					.update({
// 						status: event.type in BridgeTransactionStatusMap ? BridgeTransactionStatusMap[event.type] : "UNKNOWN",
// 						updated_at: new Date().toISOString(),
// 						transaction_hash: event.destination_tx_hash,
// 					})
// 					.eq(hasDepositId ? "bridge_transaction_record_id" : "id", hasDepositId ? bridgeTransactionInfo.id : referenceId) // check with deposit id if it exists, otherwise check with reference id
// 					.select("bridge_transaction_record_id, status, failed_reason, transaction_hash")
// 					.single()
// 					if (updateError) throw updateError

// 					const toUpdateBridge = {
// 						bridge_response: event,
// 						bridge_status: event.type,
// 						last_bridge_virtual_account_event_id: last_event_id,
// 					}

// 					const updatedBridge = await updateBridgeTransactionRecord(updatedOnrampRecord.bridge_transaction_record_id, toUpdateBridge);

// 					if (onrampTransaction.developer_fee_id) {
// 						const jobConfig = {recordId: onrampTransaction.id}
// 						const canSchedule = await chargeFeeOnFundReceivedScheduleCheck("chargeFeeOnFundReceived", jobConfig, onrampTransaction.destination_user_id, onrampTransaction.destination_user.profile_id)
// 						if (canSchedule){
// 							await createJob("chargeFeeOnFundReceived", jobConfig, onrampTransaction.destination_user_id, onrampTransaction.destination_user.profile_id, new Date().toISOString(), 0, new Date(new Date().getTime() + 60000).toISOString())
// 						}
// 					}

//                     // send slack notification if failed
//                     if (updatedOnrampRecord.status === "REFUNDED") {
//                         notifyTransaction(
//                             onrampTransaction.user_id,
//                             rampTypes.ONRAMP,
//                             onrampTransaction.id,
//                             {
//                                 prevTransactionStatus: onrampTransaction.status,
//                                 updatedTransactionStatus: updatedOnrampRecord.status,
//                                 checkbookStatus: checkbookTransactionInfo.checkbook_status,
//                                 bridgeStatus: updatedBridge.bridge_status,
//                                 failedReason: updatedOnrampRecord.failed_reason,
//                             }
//                         );
//                     }
// 					await notifyFiatToCryptoTransfer(updatedOnrampRecord)
// 					break

// 				}else{
// 					await createLog("pollOnrampTransactionsBridgeStatus/updateStatus", onrampTransaction.user_id, `No matching deposit id or reference id found for ${onrampTransaction.id} and ${depositId}`)
// 					break
// 				}
				
// 			}

// 		}

// 	} catch (error) {
// 		await createLog("pollOnrampTransactionsBridgeStatus/updateStatus", onrampTransaction.user_id, error.message)
// 		return
// 	}
// }

// async function pollOnrampTransactionsBridgeStatus() {
// 	// Get all records where the bridge_transaction_status is not 
// 	const { data: onRampTransactionStatus, error: onRampTransactionStatusError } = await supabaseCall(() => supabase
// 		.from('onramp_transactions')
// 		.select('id, user_id, destination_user_id, developer_fee_id, status, destination_user: destination_user_id(profile_id), checkbook_transaction_record_id, bridge_transaction_record_id, checkbook_transaction_info:checkbook_transaction_record_id(*), bridge_transaction_info:bridge_transaction_record_id(*)')
// 		.eq("crypto_provider", "BRIDGE")
// 		.or('status.eq.FIAT_PROCESSED,status.eq.FIAT_CONFIRMED,status.eq.CRYPTO_SUBMITTED,status.eq.CRYPTO_IN_REVIEW')
// 		.order('updated_at', { ascending: true })
// 	)

// 	if (onRampTransactionStatusError) {
// 		console.error('Failed to fetch transactions for pollOnrampTransactionsBridgeStatus', onRampTransactionStatusError);
// 		await createLog('pollOnrampTransactionsBridgeStatus', null, onRampTransactionStatusError.message, onRampTransactionStatusError);
// 		return;
// 	}

// 	await Promise.all(onRampTransactionStatus.map(async (onrampTransaction) =>{
// 		if (onrampTransaction.checkbook_transaction_record_id && onrampTransaction.bridge_transaction_record_id){
//             await updateStatus(onrampTransaction);
//         }
// 	}))

// }

// module.exports = pollOnrampTransactionsBridgeStatus
