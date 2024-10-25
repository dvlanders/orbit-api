const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const { BastionTransferStatus } = require('../../src/util/bastion/utils/utils');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const createLog = require('../../src/util/logger/supabaseLogger');
const { simulateSandboxCryptoToFiatTransactionStatus } = require('../../src/util/transfer/cryptoToBankAccount/utils/simulateSandboxCryptoToFiatTransaction');
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
	"COMPLETED_ONCHAIN": "COMPLETED",
	"FAILED": "FAILED_ONCHAIN"
}

const cryptoToFiatStatusMapBastion = statusMapBastion.CRYPTO_TO_FIAT
const cryptoToFiatStatusMapCircle = statusMapCircle.CRYPTO_TO_FIAT

const _simulateSandbox = async(status, updatedData) => {
	if (status == "COMPLETED"){
		await simulateSandboxCryptoToFiatTransactionStatus(updatedData, ["COMPLETED_ONCHAIN", "IN_PROGRESS_FIAT", "INITIATED_FIAT"])
	}

	if (status == "FAILED_ONCHAIN" || status == "COMPLETED"){
		await notifyCryptoToFiatTransfer(updatedData)
	}
	
}

const updateStatusBastionLegacy = async (transaction) => {
	const bastionUserId = transaction.bastion_user_id
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
			await createLog('pollOfframpTransactionsBastionStatus', transaction.user_id, errorMessage, data);
			const { data: updateData, error: updateError } = await supabaseCall(() => supabase
				.from('offramp_transactions')
				.update({
					transaction_status: "UNKNOWN",
					bastion_response: data,
					updated_at: new Date().toISOString(),
					failed_reason: "Please contact HIFI for more information"
				})
				.eq('id', transaction.id)
				.select()
				.single()
			)

			return
		}

		// Map the data.status to our transaction_status
		const hifiOfframpTransactionStatus = hifiOfframpTransactionStatusMap[data.status] || 'UNKNOWN';


		// update specific for sandbox
		if (process.env.NODE_ENV == "development" && transaction.source_currency == "usdHifi"){
			const toUpdateInSandbox = {
				transaction_status: sandboxHifiOfframpTransactionStatusMap[hifiOfframpTransactionStatus] || "UNKNOWN",
				updated_at: new Date().toISOString()
			}
			const updatedData = await updateOfframpTransactionRecord(transaction.id, toUpdateInSandbox)
			await _simulateSandbox(toUpdateInSandbox.transaction_status, updatedData)
			return
		}

		// If the hifiOfframpTransactionStatus is different from the current transaction_status or if the data.status is different than the transaction.bastion_transaction_status, update the transaction_status
		if (hifiOfframpTransactionStatus !== transaction.transaction_status || data.status !== transaction.bastion_transaction_status) {
			const { data: updateData, error: updateError } = await supabaseCall(() => supabase
				.from('offramp_transactions')
				.update({
					transaction_status: hifiOfframpTransactionStatus,
					bastion_transaction_status: data.status,
					bastion_response: data,
					updated_at: new Date().toISOString()
				})
				.eq('id', transaction.id)
				.select()
				.single()
			)

			if (updateError) {
				console.error('Failed to update transaction status', updateError);
				await createLog('pollOfframpTransactionsBastionStatus', transaction.user_id, 'Failed to update transaction status', updateError);
				return
			}

			if (transaction.developer_fee_id){
				// update fee charged
				const { data: updateFeeData, error: updateFeeError } = await supabaseCall(() => supabase
					.from('developer_fees')
					.update({
						charged_status: data.status,
						bastion_status: data.status,
						bastion_response: data,
						updated_at: new Date().toISOString()
					})
					.eq('id', transaction.developer_fee_id)
					.select()
					.single())
		
				if (updateFeeError) {
					console.error('Failed to update fee status', updateError);
					await createLog('pollOfframpTransactionsBastionStatus/updateStatus', transaction.user_id, 'Failed to update fee status', updateError);
					return
				}
			}

			// console.log('Updated transaction status for transaction ID', transaction.id, 'to', hifiOfframpTransactionStatus);

			// send webhook message
			await notifyCryptoToFiatTransfer(updateData)

		}
	} catch (error) {
		await createLog('pollOfframpTransactionsBastionStatus', transaction.user_id, error.message, error);
	}
}

const updateStatusBastion = async (transaction) => {
	// legacy for un-upgraded bastion operations
	if (!transaction.bastionTransaction){
		await updateStatusBastionLegacy(transaction)
		return
	}

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
			updated_at: new Date().toISOString(),
			bastion_response: data
		}
		if (response.status == 404){
			await createLog('pollOfframpTransactionsStatus/updateStatusBastion', transaction.user_id, `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`, data);
		}else if (!response.ok){
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`;
			await createLog('pollOfframpTransactionsStatus/updateStatusBastion', transaction.user_id, errorMessage, data);
		}else{
			toUpdate.transaction_status = cryptoToFiatStatusMapBastion[data.status] || "UNKNOWN"
			toUpdate.transaction_hash = data.transactionHash

			toUpdateBastionTransaction.bastion_status = data.status
		}
		
		const [updatedRequest, updateBastionTransaction, updatedFeeRecord] = await Promise.all([
			updateOfframpTransactionRecord(transaction.id, toUpdate),
			updateBastionTransactionRecord(transaction.bastion_transaction_record_id, toUpdateBastionTransaction),
			transaction.developer_fee_id ? updateDeveloperFeeRecordBastion(transaction.feeRecord, data, response) : Promise.resolve(null)
		])

		// sandbox specific
		if (process.env.NODE_ENV == "development" && transaction.fiat_provider !== "BLINDPAY"){
			const toUpdateInSandbox = {
				transaction_status: sandboxHifiOfframpTransactionStatusMap[toUpdate.transaction_status] || "UNKNOWN",
				updated_at: new Date().toISOString()
			}
			const updatedData = await updateOfframpTransactionRecord(transaction.id, toUpdateInSandbox)
			await _simulateSandbox(toUpdateInSandbox.transaction_status, updatedData)
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
		const toUpdate = {
			updated_at: new Date().toISOString()
		}
		const toUpdateCircleTransaction = {
			updated_at: new Date().toISOString(),
			circle_response: data,
		}
		if (!response.ok) {
			await createLog('pollOfframpTransactionsStatus/updateStatusCircle', transaction.user_id, data.message, data);
            return
		}else{
			const transaction = data.data.transaction
            toUpdate.transaction_status = cryptoToFiatStatusMapCircle[transaction.state] || "UNKNOWN"
            toUpdate.transaction_hash = transaction.txHash

            toUpdateCircleTransaction.circle_status = transaction.state
		}

		const [updatedRequest, updateCircleTransaction, updatedFeeRecord] = await Promise.all([
			updateOfframpTransactionRecord(transaction.id, toUpdate),
			updateCircleTransactionRecord(transaction.circle_transaction_record_id, toUpdateCircleTransaction),
			transaction.developer_fee_id ? updateDeveloperFeeRecordCircle(transaction.feeRecord, data, response) : Promise.resolve(null)
		])

		// sandbox specific
		if (process.env.NODE_ENV == "development"){
			const toUpdateInSandbox = {
				transaction_status: sandboxHifiOfframpTransactionStatusMap[toUpdate.transaction_status] || "UNKNOWN",
				updated_at: new Date().toISOString()
			}
			const updatedData = await updateOfframpTransactionRecord(transaction.id, toUpdateInSandbox)
			await _simulateSandbox(toUpdateInSandbox.transaction_status, updatedData)
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
