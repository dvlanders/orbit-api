const { updateBastionTransactionRecord } = require("../../src/util/bastion/main/bastionTransactionTableService");
const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const { updateCircleTransactionRecord } = require("../../src/util/circle/main/circleTransactionTableService");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { updateRequestRecord } = require("../../src/util/transfer/cryptoToCrypto/main/updateRequestRecord");
const { updateDeveloperFeeRecordBastion } = require("../../src/util/transfer/fee/updateFeeBastion");
const { updateDeveloperFeeRecordCircle } = require("../../src/util/transfer/fee/updateFeeCircle");
const { statusMapBastion } = require("../../src/util/transfer/walletOperations/bastion/statusMap");
const { statusMapCircle } = require("../../src/util/transfer/walletOperations/circle/statusMap");
const { safeParseBody } = require("../../src/util/utils/response");
const notifyCryptoToCryptoTransfer = require("../../webhooks/transfer/notifyCryptoToCryptoTransfer");
const { BASTION_URL, BASTION_API_KEY, CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;



const cryptoToCryptoStatusMapCircle = statusMapCircle.CRYPTO_TO_CRYPTO
const cryptoToCryptoStatusMapBastion = statusMapBastion.CRYPTO_TO_CRYPTO


const updateStatusBastion = async (transaction) => {
	const bastionUserId = transaction.bastionTransaction.bastion_user_id
	const bastionRequestId = transaction.bastionTransaction.request_id
	const url = `${BASTION_URL}/v1/user-actions/${bastionRequestId}?userId=${bastionUserId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await safeParseBody(response)
		const toUpdate = {
			updated_at: new Date().toISOString()
		}
		const toUpdateBastionTransaction = {
			updated_at: new Date().toISOString()
		}
		if (response.status == 404){
			await createLog('pollCryptoToCryptoTransferStatus/updateStatus', transaction.sender_user_id, `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`, data);
		}else if (!response.ok){
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${transaction.bastion_request_id}`;
			await createLog('pollCryptoToCryptoTransferStatus/updateStatus', transaction.sender_user_id, errorMessage, data);
		}else{
			toUpdate.status = cryptoToCryptoStatusMapBastion[data.status] || "UNKNOWN"
			toUpdate.transaction_hash = data.transactionHash

			toUpdateBastionTransaction.bastion_response = data
			toUpdateBastionTransaction.bastion_status = data.status
		}
		

		const [updatedRequest, updateBastionTransaction, updatedFeeRecord] = await Promise.all([
			updateRequestRecord(transaction.id, toUpdate),
			updateBastionTransactionRecord(transaction.bastion_transaction_record_id, toUpdateBastionTransaction),
			transaction.developer_fee_id ? updateDeveloperFeeRecordBastion(transaction.feeRecord, data, response) : Promise.resolve(null)
		])

		if (data.status == transaction.status) return
		await notifyCryptoToCryptoTransfer(updatedRequest)


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
			await createLog('pollCryptoToCryptoTransferStatus/updateStatusCircle', transaction.sender_user_id, data.message, data);
            toUpdate = {
                updated_at: new Date().toISOString(),
            }
			toUpdateCircleTransaction = {
				updated_at: new Date().toISOString(),
				circle_response: data,
			}
			
		}else{
			const transaction = data.data.transaction
            toUpdate = {
                status: cryptoToCryptoStatusMapCircle[transaction.state] || "UNKNOWN",
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
			transaction.developer_fee_id ? updateDeveloperFeeRecordCircle(transaction.feeRecord, data, response) : Promise.resolve(null)
		])

		if (transaction.status == toUpdate.status) return
		// if status change , notify
		await notifyCryptoToCryptoTransfer(updatedRequest)


	} catch (error) {
		console.error('Failed to fetch transaction status from Circle API', error);
		await createLog('pollCryptoToCryptoTransferStatus/updateStatusCircle', transaction.sender_user_id, 'Failed to fetch transaction status from Circle API', error);
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
			.select('*, circleTransaction: circle_transaction_record_id(*), feeRecord: developer_fee_id(*), bastionTransaction: bastion_transaction_record_id(*)')
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