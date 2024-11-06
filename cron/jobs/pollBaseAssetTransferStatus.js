const { updateBastionTransactionRecord } = require("../../src/util/bastion/main/bastionTransactionTableService");
const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const { updateCircleTransactionRecord } = require("../../src/util/circle/main/circleTransactionTableService");
const { fetchWithLogging } = require("../../src/util/logger/fetchLogger");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { updateBaseAssetTransactionRecord } = require("../../src/util/transfer/baseAsset/utils/baseAssetTransactionTableService");
const { statusMapBastion } = require("../../src/util/transfer/walletOperations/bastion/statusMap");
const { statusMapCircle } = require("../../src/util/transfer/walletOperations/circle/statusMap");
const { safeParseBody } = require("../../src/util/utils/response");
const notifyBaseAssetWithdraw = require("../../webhooks/transfer/notifyBaseAssetWithdraw");
const notifyCryptoToCryptoTransfer = require("../../webhooks/transfer/notifyCryptoToCryptoTransfer");
const { BASTION_URL, BASTION_API_KEY, CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;

const baseAssetTransactionStatusMapBastion = statusMapBastion.BASE_ASSET
const baseAssetTransactionStatusMapCircle = statusMapCircle.BASE_ASSET


const updateStatusBastion = async (transaction) => {
	const bastionRequestId = transaction.bastionTransaction.request_id
	const url = `${BASTION_URL}/v1/crypto/transfers/${bastionRequestId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetchWithLogging(url, options, "BASTION");
		const data = await safeParseBody(response)
		const toUpdate = {
			updated_at: new Date().toISOString()
		}
		const toUpdateBastionTransaction = {
			updated_at: new Date().toISOString()
		}
		if (response.status == 404){
			await createLog('pollBaseAssetTransferStatus/updateStatusBastion', transaction.sender_user_id, `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`, data);
		}else if (!response.ok){
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`;
			await createLog('pollBaseAssetTransferStatus/updateStatusBastion', transaction.sender_user_id, errorMessage, data);
		}else{
			toUpdate.status = baseAssetTransactionStatusMapBastion[data.status] || "UNKNOWN"
			toUpdate.transaction_hash = data.transactionHash

			toUpdateBastionTransaction.bastion_response = data
			toUpdateBastionTransaction.bastion_status = data.status
		}
		

		const [updatedRequest, updateBastionTransaction] = await Promise.all([
			updateBaseAssetTransactionRecord(transaction.id, toUpdate),
			updateBastionTransactionRecord(transaction.bastion_transaction_record_id, toUpdateBastionTransaction),
		])

	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollBaseAssetTransferStatus/updateStatusBastion', transaction.sender_user_id, 'Failed to fetch transaction status from Bastion API', error);
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
		const response = await fetchWithLogging(url, options, "CIRCLE");
		const data = await safeParseBody(response)
		let toUpdate, toUpdateCircleTransaction
		if (!response.ok) {
			await createLog('pollBaseAssetTransferStatus/updateStatusCircle', transaction.sender_user_id, data.message, data);
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
                status: baseAssetTransactionStatusMapCircle[transaction.state] || "UNKNOWN",
                transaction_hash: transaction.txHash,
                updated_at: new Date().toISOString()
            }
			toUpdateCircleTransaction = {
				circle_status: transaction.state,
				updated_at: new Date().toISOString(),
				circle_response: data,
			}
        }
		const [updatedRequest, updateCircleTransaction] = await Promise.all([
			updateBaseAssetTransactionRecord(transaction.id, toUpdate),
			updateCircleTransactionRecord(transaction.circle_transaction_record_id, toUpdateCircleTransaction),
		])
	} catch (error) {
		console.error('Failed to fetch transaction status from Circle API', error);
		await createLog('pollBaseAssetTransferStatus/updateStatusCircle', transaction.sender_user_id, 'Failed to fetch transaction status from Circle API', error);
	}
}

const updateFunctionMap = {
	BASTION: updateStatusBastion,
	CIRCLE: updateStatusCircle
}



async function pollBaseAssetTransferStatus() {
	try {
		// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
		const { data: baseAssetTransactionData, error: baseAssetTransactionDataError } = await supabaseCall(() => supabase
			.from('base_asset_transactions')
			.update({ updated_at: new Date().toISOString() })
			.or("status.eq.SUBMITTED,status.eq.ACCEPTED,status.eq.PENDING")
			.order('updated_at', { ascending: true })
			.select('*, bastionTransaction:bastion_transaction_record_id(*), circleTransaction:circle_transaction_record_id(*)')
		)

		if (baseAssetTransactionDataError) {
			await createLog('pollBaseAssetTransferStatus', null, 'Failed to fetch transactions', baseAssetTransactionDataError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(baseAssetTransactionData.map(async (transaction) => {
			const updateFunction = updateFunctionMap[transaction.wallet_provider]
			if (!updateFunction) {
				await createLog('pollBaseAssetTransferStatus', transaction.sender_user_id, `Unsupported wallet provider: ${transaction.wallet_provider}`)
				return
			}
			await updateFunction(transaction)
		}))
	} catch (error) {
		await createLog("pollBaseAssetTransferStatus", null, "Failed to poll Bastion base asset transfer status", error.message)
	}
}

module.exports = pollBaseAssetTransferStatus;