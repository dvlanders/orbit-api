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
const { updateBridgingTransactionRecord } = require('../../src/util/transfer/bridging/bridgingTransactionTableService');
const notifyBridgingUpdate = require('../../webhooks/bridging/notifyBridgingUpdate');
const { BASTION_URL, BASTION_API_KEY, CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;

const bridgeAssetStatusMapBastion = statusMapBastion.BRIDGE_ASSET
const bridgeAssetStatusMapCircle = statusMapCircle.BRIDGE_ASSET


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
			updated_at: new Date().toISOString(),
			bastion_response: data
		}
		if (response.status == 404){
			await createLog('pollOfframpTransactionsStatus/updateStatusBastion', transaction.user_id, `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`, data);
		}else if (!response.ok){
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`;
			await createLog('pollOfframpTransactionsStatus/updateStatusBastion', transaction.user_id, errorMessage, data);
		}else{
			toUpdate.status = bridgeAssetStatusMapBastion[data.status] || "UNKNOWN"
			toUpdate.transaction_hash = data.transactionHash

			toUpdateBastionTransaction.bastion_status = data.status
		}
		
		const [updatedRequest, updateBastionTransaction, updatedFeeRecord] = await Promise.all([
			updateBridgingTransactionRecord(transaction.id, toUpdate),
			updateBastionTransactionRecord(transaction.bastion_transaction_record_id, toUpdateBastionTransaction),
			transaction.developer_fee_record_id ? updateDeveloperFeeRecordBastion(transaction.feeRecord, data, response) : Promise.resolve(null)
		])

		if (!toUpdate.status || toUpdate.status == transaction.status) return
		
		await notifyBridgingUpdate(updatedRequest)


	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollBridgingCryptoStatus/updateStatusBastion', transaction.source_user_id, 'Failed to fetch transaction status from Bastion API', error);
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
            toUpdate.status = bridgeAssetStatusMapCircle[transaction.state] || "UNKNOWN"
            toUpdate.transaction_hash = transaction.txHash

            toUpdateCircleTransaction.circle_status = transaction.state
		}

		const [updatedRequest, updateCircleTransaction, updatedFeeRecord] = await Promise.all([
			updateBridgingTransactionRecord(transaction.id, toUpdate),
			updateCircleTransactionRecord(transaction.circle_transaction_record_id, toUpdateCircleTransaction),
			transaction.developer_fee_record_id ? updateDeveloperFeeRecordCircle(transaction.feeRecord, data, response) : Promise.resolve(null)
		])

		if (!toUpdate.status || toUpdate.status == transaction.status) return
		// if status change , notify
		await notifyBridgingUpdate(updatedRequest)


	} catch (error) {
		console.error('Failed to fetch transaction status from Circle API', error);
		await createLog('pollBridgingCryptoStatus/updateStatusCircle', transaction.source_user_id, 'Failed to fetch transaction status from Circle API', error);
	}
}

const updateFunctionMap = {
	BASTION: updateStatusBastion,
	CIRCLE: updateStatusCircle
}

async function pollBridgingCryptoStatus() {
	// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
	const { data: bridgingTransactionData, error: bridgingTransactionError } = await supabaseCall(() => supabase
		.from('bridging_transactions')
		.update({updated_at: new Date().toISOString()})
		.or("status.eq.SUBMITTED,status.eq.PENDING")
		.order('updated_at', { ascending: true })
		.select('*, bastionTransaction:bastion_transaction_record_id (bastion_user_id, request_id), circleTransaction:circle_transaction_record_id (circle_transaction_id), feeRecord:developer_fee_record_id (*)')
	)


	if (bridgingTransactionError) {
		console.error('Failed to fetch transactions for bridging crypto provider', bridgingTransactionError);
		await createLog('pollBridgingCryptoStatus', null, 'Failed to fetch transactions', bridgingTransactionError);
		return;
	}

	// For each transaction, get the latest status from the Bastion API and update the db
	await Promise.all(bridgingTransactionData.map(async (transaction) => {
		const updateFunction = updateFunctionMap[transaction.source_wallet_provider]
		if (!updateFunction) {
			await createLog('pollBridgingCryptoStatus', transaction.source_user_id, 'No update function for crypto provider', transaction.source_wallet_provider);
			return;
		}
		await updateFunction(transaction)
	}))
}

module.exports = pollBridgingCryptoStatus;
