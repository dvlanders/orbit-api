const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const { BastionTransferStatus } = require('../../src/util/bastion/utils/utils');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const createLog = require('../../src/util/logger/supabaseLogger');
const { simulateSandboxCryptoToFiatTransactionStatus } = require('../../src/util/transfer/cryptoToBankAccount/utils/simulateSandboxCryptoToFiatTransaction');
const { executeBlindpayPayoutScheduleCheck } = require('../../asyncJobs/transfer/executeBlindpayPayout/scheduleCheck');
const createJob = require('../../asyncJobs/createJob');
const { statusMapBastion } = require('../../src/util/transfer/walletOperations/bastion/statusMap');
const { statusMapCircle } = require('../../src/util/transfer/walletOperations/circle/statusMap');
const { updateOfframpTransactionRecord } = require('../../src/util/transfer/cryptoToBankAccount/utils/offrampTransactionsTableService');
const { updateBastionTransactionRecord } = require('../../src/util/bastion/main/bastionTransactionTableService');
const { updateDeveloperFeeRecordBastion } = require('../../src/util/transfer/fee/updateFeeBastion');
const { safeParseBody } = require('../../src/util/utils/response');
const { updateCircleTransactionRecord } = require('../../src/util/circle/main/circleTransactionTableService');
const { updateDeveloperFeeRecordCircle } = require('../../src/util/transfer/fee/updateFeeCircle');
const { BASTION_URL, BASTION_API_KEY, CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;

const hifiOfframpTransactionStatusMap = {
	"ACCEPTED": "SUBMITTED_ONCHAIN",
	"SUBMITTED": "SUBMITTED_ONCHAIN",
	"CONFIRMED": "COMPLETED_ONCHAIN",
	"FAILED": "FAILED_ONCHAIN"
}

const sandboxHifiOfframpTransactionStatusMap = {
	"SUBMITTED_ONCHAIN": "SUBMITTED_ONCHAIN",
	"SUBMITTED_ONCHAIN": "SUBMITTED_ONCHAIN",
	"COMPLETED_ONCHAIN": "COMPLETED",
	"FAILED": "FAILED_ONCHAIN"
}

const cryptoToFiatStatusMapBastion = statusMapBastion.CRYPTO_TO_FIAT
const cryptoToFiatStatusMapCircle = statusMapCircle.CRYPTO_TO_FIAT

const _simulateSandbox = async(status) => {
	if (status == "COMPLETED"){
		await simulateSandboxCryptoToFiatTransactionStatus(updateData, ["COMPLETED_ONCHAIN", "IN_PROGRESS_FIAT", "INITIATED_FIAT"])
	}

	if (status == "FAILED_ONCHAIN" || status == "COMPLETED"){
		await notifyCryptoToFiatTransfer(updateData)
	}
	
}

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

		// update specific for sandbox
		if (process.env.NODE_ENV == "development" && transaction.source_currency == "usdHifi"){
			await _simulateSandbox(transaction, response, data)
			return
		}

		const toUpdate = {
			updated_at: new Date().toISOString()
		}
		const toUpdateBastionTransaction = {
			updated_at: new Date().toISOString()
		}
		if (response.status == 404){
			await createLog('pollOfframpTransactionsStatus/updateStatusBastion', transaction.user_id, `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`, data);
		}else if (!response.ok){
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`;
			await createLog('pollOfframpTransactionsStatus/updateStatusBastion', transaction.user_id, errorMessage, data);
		}else{
			toUpdate.status = cryptoToFiatStatusMapBastion[data.status] || "UNKNOWN"
			toUpdate.transaction_hash = data.transactionHash

			toUpdateBastionTransaction.bastion_response = data
			toUpdateBastionTransaction.bastion_status = data.status
		}
		
		const [updatedRequest, updateBastionTransaction, updatedFeeRecord] = await Promise.all([
			updateOfframpTransactionRecord(transaction.id, toUpdate),
			updateBastionTransactionRecord(transaction.bastion_transaction_record_id, toUpdateBastionTransaction),
			transaction.developer_fee_id ? updateDeveloperFeeRecordBastion(transaction.feeRecord, data, response) : Promise.resolve(null)
		])

		// sandbox specific
		if (process.env.NODE_ENV == "development" && transaction.source_currency == "usdHifi"){
			const toUpdate = {
				transaction_status: sandboxHifiOfframpTransactionStatusMap[cryptoToFiatStatusMapBastion[data.status]] || "UNKNOWN",
				updated_at: new Date().toISOString()
			}
			await updateOfframpTransactionRecord(transaction.id, toUpdate)
			await _simulateSandbox(toUpdate.transaction_status)
			return
		}

		if (!toUpdate.status || toUpdate.status == transaction.transaction_status) return
		
		await notifyCryptoToFiatTransfer(updatedRequest)


	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollOfframpTransactionsStatus/updateStatusBastion', transaction.user_id, 'Failed to fetch transaction status from Bastion API', error);
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
			await createLog('pollOfframpTransactionsStatus/updateStatusCircle', transaction.user_id, data.message, data);
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
                status: cryptoToFiatStatusMapCircle[transaction.state] || "UNKNOWN",
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
			updateOfframpTransactionRecord(transaction.id, toUpdate),
			updateCircleTransactionRecord(transaction.circle_transaction_record_id, toUpdateCircleTransaction),
			transaction.developer_fee_id ? updateDeveloperFeeRecordCircle(transaction.feeRecord, data, response) : Promise.resolve(null)
		])

		// sandbox specific
		if (process.env.NODE_ENV == "development" && transaction.source_currency == "usdHifi"){
			const toUpdate = {
				transaction_status: sandboxHifiOfframpTransactionStatusMap[cryptoToFiatStatusMapCircle[data.status]] || "UNKNOWN",
				updated_at: new Date().toISOString()
			}
			await updateOfframpTransactionRecord(transaction.id, toUpdate)
			await _simulateSandbox(toUpdate.status)
			return
		}

		if (!toUpdate.status || toUpdate.status == transaction.transaction_status) return
		// if status change , notify
		await notifyCryptoToFiatTransfer(updatedRequest)


	} catch (error) {
		console.error('Failed to fetch transaction status from Circle API', error);
		await createLog('pollOfframpTransactionsStatus/updateStatusCircle', transaction.sender_user_id, 'Failed to fetch transaction status from Circle API', error);
	}
}

const updateFunctionMap = {
	BASTION: updateStatusBastion,
	CIRCLE: updateStatusCircle
}

async function pollOfframpTransactionsCryptoStatus() {
	// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
	const { data: offrampTransactionData, error: offrampTransactionError } = await supabaseCall(() => supabase
		.from('offramp_transactions')
		.update({updated_at: new Date().toISOString()})
		.eq("transaction_status", "SUBMITTED_ONCHAIN")
		.order('updated_at', { ascending: true })
		.select('*, bastionTransaction:bastion_transaction_record_id (bastion_user_id, request_id), circleTransaction:circle_transaction_record_id (circle_transaction_id), feeRecord:developer_fee_id (*)')
	)


	if (offrampTransactionError) {
		console.error('Failed to fetch transactions for offramp crypto provider', offrampTransactionError);
		await createLog('pollOfframpTransactionsStatus', null, 'Failed to fetch transactions', offrampTransactionError);
		return;
	}

	// For each transaction, get the latest status from the Bastion API and update the db
	await Promise.all(offrampTransactionData.map(async (transaction) => {
		const updateFunction = updateFunctionMap[transaction.crypto_provider]
		if (!updateFunction) {
			await createLog('pollOfframpTransactionsStatus', transaction.user_id, 'No update function for crypto provider', transaction.crypto_provider);
			return;
		}
		await updateFunction(transaction)
	}))
}

module.exports = pollOfframpTransactionsCryptoStatus;
