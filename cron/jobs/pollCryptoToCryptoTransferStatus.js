const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const { updateCircleTransactionRecord } = require("../../src/util/circle/main/circleTransactionTableService");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { updateRequestRecord } = require("../../src/util/transfer/cryptoToCrypto/main/updateRequestRecord");
const { updateDeveloperFeeRecordBastion } = require("../../src/util/transfer/fee/updateFeeBastion");
const { updateDeveloperFeeRecordCircle } = require("../../src/util/transfer/fee/updateFeeCircle");
const { safeParseBody } = require("../../src/util/utils/response");
const notifyCryptoToCryptoTransfer = require("../../webhooks/transfer/notifyCryptoToCryptoTransfer");
const { BASTION_URL, BASTION_API_KEY, CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;

const statusMapCircle = {
	"INITIATED": "SUBMITTED",
	"QUEUED": "PENDING",
	"PENDING_RISK_SCREENING": "PENDING",
	"SENT": "PENDING",
	"CONFIRMED": "PENDING",
	"COMPLETE": "CONFIRMED",
	"CANCELED": "CANCELED",
	"FAILED": "FAILED",
	"DENIED": "FAILED",
	"ACCELERATED": "PENDING"
}


const updateStatusBastion = async (transaction) => {
	const bastionUserId = transaction.sender_bastion_user_id
	const url = `${BASTION_URL}/v1/user-actions/${transaction.bastion_request_id}?userId=${bastionUserId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		if (response.status === 404 || !response.ok) {
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${transaction.bastion_request_id}`;
			console.error(errorMessage);
			await createLog('pollCryptoToCryptoTransferStatus/updateStatus', transaction.sender_user_id, errorMessage, data);
			return
		}
		if (data.status == transaction.status) return
		// If the hifiOfframpTransactionStatus is different from the current transaction_status or if the data.status is different than the transaction.bastion_transaction_status, update the transaction_status
		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
			.from('crypto_to_crypto')
			.update({
				status: data.status,
				bastion_response: data,
				updated_at: new Date().toISOString()
			})
			.eq('id', transaction.id)
			.select("*")
			.single())

		if (updateError) {
			console.error('Failed to update transaction status', updateError);
			await createLog('pollOfframpTransactionsBastionStatus/updateStatus', transaction.sender_user_id, 'Failed to update transaction status', updateError);
			return
		}

		if (transaction.developer_fee_id) {
			// update fee charged
			await updateDeveloperFeeRecordBastion(transaction.feeRecord, data, response)
		}

		await notifyCryptoToCryptoTransfer(updateData)


	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollOfframpTransactionsStatus/updateStatusBastion', transaction.sender_user_id, 'Failed to fetch transaction status from Bastion API', error);
	}
}

const updateStatusCircle = async (transaction) => {
	const circleTransactionId = transaction.circleTransaction.circle_transaction_id
	const url = `${CIRCLE_WALLET_URL}/v1/w3s/transactions/${circleTransactionId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${CIRCLE_WALLET_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await safeParseBody(response)
		let toUpdate, toUpdateCircleTransaction
		if (!response.ok) {
			await createLog('pollOfframpTransactionsStatus/updateStatusCircle', contractAction.user_id, data.message, data);
            toUpdate = {
				status: "FAILED",
                updated_at: new Date().toISOString(),
				failed_reason: "Please contact HIFI support for more information"
            }
			toUpdateCircleTransaction = {
				circle_status: "FAILED",
				updated_at: new Date().toISOString(),
				circle_response: data,
			}
			
		}else{
			const transaction = data.data.transaction
            toUpdate = {
                status: statusMapCircle[transaction.state] || "UNKNOWN",
                transaction_hash: transaction.txHash,
                updated_at: new Date().toISOString()
            }
			toUpdateCircleTransaction = {
				circle_status: transaction.state,
				updated_at: new Date().toISOString(),
				circle_response: data,
			}
        }
		const [updatedRequest, updateCircleTransaction, updatedFeeRecord] = await Promise.all([
			updateRequestRecord(transaction.id, toUpdate),
			updateCircleTransactionRecord(transaction.circle_transaction_record_id, toUpdateCircleTransaction),
			async() => {
				if (transaction.developer_fee_id) {
					await updateDeveloperFeeRecordCircle(transaction.feeRecord, data, response)
				}
			}
		])

		if (transaction.status == toUpdate.status) return
		// if status change , notify
		await notifyCryptoToCryptoTransfer(updatedRequest)


	} catch (error) {
		console.error('Failed to fetch transaction status from Circle API', error);
		await createLog('pollOfframpTransactionsStatus/updateStatusCircle', transaction.sender_user_id, 'Failed to fetch transaction status from Circle API', error);
	}
}

const updateFunctionMap = {
	BASTION: updateStatusBastion,
	CIRCLE: updateStatusCircle
}



async function pollCryptoToCryptoTransferStatus() {
	try {
		// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
		const { data: cryptoTransactionData, error: cryptoTransactionDataError } = await supabaseCall(() => supabase
			.from('crypto_to_crypto')
			.update({ updated_at: new Date().toISOString() })
			.or("status.eq.SUBMITTED,status.eq.ACCEPTED,status.eq.PENDING")
			.order('updated_at', { ascending: true })
			.select('*, circleTransaction: circle_transaction_record_id(*), feeRecord: developer_fee_id(*)')
		)

		if (cryptoTransactionDataError) {
			console.error('Failed to fetch transactions for pollCryptoToCryptoTransferStatus', cryptoTransactionDataError);
			await createLog('pollOfframpTransactionsStatus', null, 'Failed to fetch transactions', cryptoTransactionDataError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(cryptoTransactionData.map(async (transaction) => {
			const updateFunction = updateFunctionMap[transaction.provider]
			if (!updateFunction) {
				createLog('pollOfframpTransactionsStatus', transaction.sender_user_id, `Unsupported provider: ${transaction.provider}`)
				return
			}
			await updateFunction(transaction)
		}))
	} catch (error) {
		await createLog("pollOfframpTransactionsStatus", null, "Failed to poll Bastion crypto to crypto transfer status", error.message)
	}
}

module.exports = pollCryptoToCryptoTransferStatus;