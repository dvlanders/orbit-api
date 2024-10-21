// const { supabaseCall } = require('../../src/util/supabaseWithRetry');
// const supabase = require('../../src/util/supabaseClient');
// const createLog = require('../../src/util/logger/supabaseLogger');
// const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
// const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
// const notifyTransaction = require("../../src/util/logger/transactionNotifier");
// const { rampTypes } = require("../../src/util/transfer/utils/ramptType");
// const { updateBridgeTransactionRecord } = require('../../src/util/bridge/bridgeTransactionTableService');
// const { updateOfframpTransactionRecord } = require('../../src/util/transfer/cryptoToBankAccount/utils/offrampTransactionsTableService');
// const { safeParseBody } = require('../../src/util/utils/response');
// const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
// const BRIDGE_URL = process.env.BRIDGE_URL;

// const hifiOfframpTransactionStatusMap = {
// 	"awaiting_funds": "COMPLETED_ONCHAIN",
// 	"in_review": "IN_PROGRESS_FIAT",
// 	"funds_received": "IN_PROGRESS_FIAT",
// 	'payment_submitted': 'INITIATED_FIAT',
// 	'payment_processed': 'COMPLETED',
// 	'returned': 'FAILED_FIAT_RETURNED',
// 	'refunded': 'FAILED_FIAT_REFUNDED',
// 	'error': 'FAILED_UNKNOWN',
// 	'canceled': "CANCELLED"
// }

// const updateStatusWithBridgeTransferIdV2 = async (transaction) => {
// 	const bridgeTransaction = transaction.bridgeTransaction
// 	try {

// 		const response = await fetch(`${BRIDGE_URL}/v0/transfers/${bridgeTransaction.bridge_transfer_id}`, {
// 			method: 'GET',
// 			headers: {
// 				'Api-Key': BRIDGE_API_KEY
// 			}
// 		});

// 		const data = await safeParseBody(response)
// 		if (!response.ok) {
// 			await createLog('pollOfframpTransactionsBridgeStatus/updateStatusWithBridgeTransferIdV2', transaction.user_id, 'Failed to fetch response from bridge', data);
// 			return
// 		}

// 		const toUpdateBridgeTransaction = {
// 			updated_at: new Date().toISOString(),
// 			bridge_response: data,
// 			bridge_status: data.state,
// 		}

// 		const transactionStatus = hifiOfframpTransactionStatusMap[data.state] || "UNKNOWN"
// 		const toUpdateOfframpTransaction = {
// 			updated_at: new Date().toISOString(),
// 			transaction_status: transactionStatus,
// 		}

// 		const [updatedBridgeTransaction, updatedOfframpTransaction] = await Promise.all([
// 			await updateBridgeTransactionRecord(bridgeTransaction.id, toUpdateBridgeTransaction),
// 			await updateOfframpTransactionRecord(transaction.id, toUpdateOfframpTransaction),
// 		])

//         // send slack notification if failed
//         if (["FAILED_FIAT_RETURNED", "FAILED_FIAT_REFUNDED", "FAILED_UNKNOWN", "UNKNOWN"].includes(transactionStatus)) {
//             notifyTransaction(
//                 transaction.user_id,
//                 rampTypes.OFFRAMP,
//                 transaction.id,
//                 {
//                     prevTransactionStatus: transaction.transaction_status,
//                     updatedTransactionStatus: updatedOfframpTransaction.transaction_status,
//                     bridgeTransactionStatus: updatedBridgeTransaction.bridge_status,
//                     failedReason: updatedOfframpTransaction.failed_reason,
//                 }
//             );
//         }

// 		if (transaction.transaction_status == transactionStatus) return
// 		// send webhook message if status changed
// 		await notifyCryptoToFiatTransfer(updatedOfframpTransaction)

// 	} catch (error) {
// 		console.error('Failed to fetch transaction status from Bridge API', error);
// 		await createLog('pollOfframpTransactionsBridgeStatus/updateStatusWithBridgeTransferId', transaction.user_id, 'Failed to fetch transaction status from Bridge API', error);
// 	}
// }

// const updateStatusWithBridgeTransferId = async (transaction) => {

// 	try {
// 		const response = await fetch(`${BRIDGE_URL}/v0/transfers/${transaction.bridge_transfer_id}`, {
// 			method: 'GET',
// 			headers: {
// 				'Api-Key': BRIDGE_API_KEY
// 			}
// 		});

// 		const data = await response.json();
// 		if (!response.ok) {
// 			await createLog('pollOfframpTransactionsBridgeStatus/updateStatusWithBridgeTransferId', transaction.user_id, 'Failed to fetch response from bridge', response);
// 			return
// 		}
        
// 		if (transaction.bridge_transaction_status == data.state) return

// 		// Map the data.state to our transaction_status
// 		const hifiOfframpTransactionStatus = hifiOfframpTransactionStatusMap[data.state] || "UNKNOWN"

// 		if (hifiOfframpTransactionStatus == transaction.transaction_status) return

// 		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
// 			.from('offramp_transactions')
// 			.update({
// 				transaction_status: hifiOfframpTransactionStatus,
// 				bridge_transaction_status: data.state,
// 				bridge_response: data,
// 				updated_at: new Date().toISOString()
// 			})
// 			.eq('id', transaction.id)
// 			.select()
// 			.single()
// 		)

// 		if (updateError) {
// 			console.error('Failed to update transaction status', updateError);
// 			await createLog('pollOfframpTransactionsBridgeStatus/updateStatusWithBridgeTransferId', transaction.user_id, 'Failed to update transaction status', updateError);
// 			return
// 		}

//         // send slack notification if failed
//         if (["FAILED_FIAT_RETURNED", "FAILED_FIAT_REFUNDED", "FAILED_UNKNOWN"].includes(hifiOfframpTransactionStatus)) {
//             notifyTransaction(
//                 transaction.user_id,
//                 rampTypes.OFFRAMP,
//                 transaction.id,
//                 {
//                     prevTransactionStatus: transaction.transaction_status,
//                     updatedTransactionStatus: updateData.transaction_status,
//                     bastionTransactionStatus: updateData.bastion_transaction_status,
//                     bridgeTransactionStatus: updateData.bridge_transaction_status,
//                     circleStatus: updateData.circle_status,
//                     blindpayPayroutStatus: updateData.blindpay_payout_status,
//                     reapPaymentStatus: updateData.reap_payment_status,
//                     failedReason: updateData.failed_reason,
//                 }
//             );
//         }

// 		// send webhook message
// 		await notifyCryptoToFiatTransfer(updateData)

// 	} catch (error) {
// 		console.error('Failed to fetch transaction status from Bridge API', error);
// 		await createLog('pollOfframpTransactionsBridgeStatus/updateStatusWithBridgeTransferId', transaction.user_id, 'Failed to fetch transaction status from Bridge API', error);
// 	}
// }


// const updateStatus = async (transaction) => {
// 	if (!transaction.to_bridge_liquidation_address_id) return
// 	const { data: destnationBridgeCustomerData, error: destnationBridgeCustomerDataError } = await supabaseCall(() => supabase
// 		.from('bridge_customers')
// 		.select('bridge_id')
// 		.eq('user_id', transaction.destination_user_id)
// 		.single()
// 	)

// 	if (destnationBridgeCustomerDataError) {
// 		console.error('Failed to fetch a single bridge id for the given user id', destnationBridgeCustomerDataError);
// 		await createLog('pollOfframpTransactionsBridgeStatus/updateStatus', transaction.user_id, 'Failed to fetch a single bridge id for the given user id', destnationBridgeCustomerDataError);
// 		return;
// 	}

// 	try {
// 		const response = await fetch(`${BRIDGE_URL}/v0/customers/${destnationBridgeCustomerData.bridge_id}/liquidation_addresses/${transaction.to_bridge_liquidation_address_id}/drains`, {
// 			method: 'GET',
// 			headers: {
// 				'Api-Key': BRIDGE_API_KEY
// 			}
// 		});

// 		const responseBody = await response.json();
// 		if (!response.ok) {
// 			await createLog('pollOfframpTransactionsBridgeStatus/updateStatus', transaction.user_id, 'Failed to fetch response from bridge', responseBody);
// 			return
// 		}

// 		const data = responseBody.data.find(item => item.deposit_tx_hash == transaction.transaction_hash);
// 		if (data === undefined) return
// 		if (transaction.bridge_transaction_status == data.state) return

// 		// Map the data.state to our transaction_status
// 		const hifiOfframpTransactionStatus =
// 			data.state === 'in_review' || data.state === 'funds_received' ? 'IN_PROGRESS_FIAT' :
// 				data.state === 'payment_submitted' ? 'INITIATED_FIAT' :
// 					data.state === 'payment_processed' ? 'COMPLETED' :
// 						data.state === 'returned' ? 'FAILED_FIAT_RETURNED' :
// 							data.state === 'refunded' ? 'FAILED_FIAT_REFUNDED' :
// 								data.state === 'error' ? 'FAILED_UNKNOWN' :
// 									'UNKNOWN';
                                    
// 		if (hifiOfframpTransactionStatus == transaction.transaction_status) return

// 		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
// 			.from('offramp_transactions')
// 			.update({
// 				transaction_status: hifiOfframpTransactionStatus,
// 				bridge_transaction_status: data.state,
// 				bridge_response: data,
// 				updated_at: new Date().toISOString()
// 			})
// 			.eq('id', transaction.id)
// 			.select()
// 			.single()
// 		)

// 		if (updateError) {
// 			console.error('Failed to update transaction status', updateError);
// 			await createLog('pollOfframpTransactionsBridgeStatus/updateStatus', transaction.user_id, 'Failed to update transaction status', updateError);
// 			return
// 		}

//         // send slack notification if failed
//         if (["FAILED_FIAT_RETURNED", "FAILED_FIAT_REFUNDED", "FAILED_UNKNOWN"].includes(hifiOfframpTransactionStatus)) {
//             notifyTransaction(
//                 transaction.user_id,
//                 rampTypes.OFFRAMP,
//                 transaction.id,
//                 {
//                     prevTransactionStatus: transaction.transaction_status,
//                     updatedTransactionStatus: updateData.transaction_status,
//                     bastionTransactionStatus: updateData.bastion_transaction_status,
//                     bridgeTransactionStatus: updateData.bridge_transaction_status,
//                     circleStatus: updateData.circle_status,
//                     blindpayPayroutStatus: updateData.blindpay_payout_status,
//                     reapPaymentStatus: updateData.reap_payment_status,
//                     failedReason: updateData.failed_reason,
//                 }
//             );
//         }

// 		// send webhook message
// 		await notifyCryptoToFiatTransfer(updateData)

// 	} catch (error) {
// 		console.error('Failed to fetch transaction status from Bridge API', error);
// 		await createLog('pollOfframpTransactionsBridgeStatus/updateStatus', transaction.user_id, 'Failed to fetch transaction status from Bridge API', error);
// 	}
// }

// async function pollOfframpTransactionsBridgeStatus() {

// 	// Get all records where the bridge_transaction_status is not 
// 	const { data: offrampTransactionData, error: offrampTransactionError } = await supabase
// 		.from('offramp_transactions')
// 		.update({ updated_at: new Date().toISOString() })
// 		.eq("fiat_provider", "BRIDGE")
// 		.or('transaction_status.eq.COMPLETED_ONCHAIN, transaction_status.eq.INITIATED_FIAT, transaction_status.eq.IN_PROGRESS_FIAT, transaction_status.eq.FAILED_FIAT_RETURNED')
// 		.order('updated_at', { ascending: true })
// 		.select('id, user_id, transaction_status, to_bridge_liquidation_address_id, bridge_transaction_status, transaction_hash, destination_user_id, transfer_from_wallet_type, bridge_transfer_id, bridgeTransaction: bridge_transaction_record_id(*), bridge_transaction_record_id')

// 	if (offrampTransactionError) {
// 		console.error('Failed to fetch transactions for pollOfframpTransactionsBridgeStatus', offrampTransactionError);
// 		await createLog('pollOfframpTransactionsBridgeStatus', null, 'Failed to fetch transactions', offrampTransactionError);
// 		return;
// 	}

// 	// For each transaction, get the latest status from the Bridge API and update the db
// 	await Promise.all(offrampTransactionData.map(async (transaction) => {
// 		if (transaction.to_bridge_liquidation_address_id) {
// 		} else if (transaction.bridge_transfer_id) {
// 			await updateStatusWithBridgeTransferId(transaction)
// 		} else if (transaction.bridge_transaction_record_id) {
// 			await updateStatusWithBridgeTransferIdV2(transaction)
// 		}
// 	}))
// }

// module.exports = pollOfframpTransactionsBridgeStatus;
