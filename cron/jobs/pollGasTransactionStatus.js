const { updateBastionTransactionRecord } = require("../../src/util/bastion/main/bastionTransactionTableService");
const { updateCircleTransactionRecord } = require("../../src/util/circle/main/circleTransactionTableService");
const { fetchWithLogging } = require("../../src/util/logger/fetchLogger");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { updateGasTransactionRecord } = require("../../src/util/transfer/gas/utils/gasTransactionTableService");
const { statusMapBastion } = require("../../src/util/transfer/walletOperations/bastion/statusMap");
const { statusMapCircle } = require("../../src/util/transfer/walletOperations/circle/statusMap");
const { safeParseBody } = require("../../src/util/utils/response");
const { BASTION_URL, BASTION_API_KEY, CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;

const gasTransactionStatusMapCircle = statusMapCircle.GAS_SPONSORSHIP
const gasTransactionStatusMapBastion = statusMapBastion.GAS_SPONSORSHIP


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
			await createLog('pollGasTransactionStatus/updateStatus', transaction.sponsor_user_id, `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`, data);
		}else if (!response.ok){
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${bastionRequestId}`;
			await createLog('pollGasTransactionStatus/updateStatus', transaction.sponsor_user_id, errorMessage, data);
		}else{
			toUpdate.status = gasTransactionStatusMapBastion[data.status] || "UNKNOWN"
			toUpdate.transaction_hash = data.transactionHash

			toUpdateBastionTransaction.bastion_response = data
			toUpdateBastionTransaction.bastion_status = data.status
		}
		

		const [updatedRequest, updateBastionTransaction] = await Promise.all([
			updateGasTransactionRecord(transaction.id, toUpdate),
			updateBastionTransactionRecord(transaction.bastion_transaction_record_id, toUpdateBastionTransaction),
		])

	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollGasTransactionStatus/updateStatusBastion', transaction.sponsor_user_id, 'Failed to fetch transaction status from Bastion API', error);
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
			await createLog('pollGasTransactionStatus/updateStatusCircle', transaction.sponsor_user_id, data.message, data);
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
                status: gasTransactionStatusMapCircle[transaction.state] || "UNKNOWN",
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
			updateGasTransactionRecord(transaction.id, toUpdate),
			updateCircleTransactionRecord(transaction.circle_transaction_record_id, toUpdateCircleTransaction),
		])
	} catch (error) {
		console.error('Failed to fetch transaction status from Circle API', error);
		await createLog('pollGasTransactionStatus/updateStatusCircle', transaction.sponsor_user_id, 'Failed to fetch transaction status from Circle API', error);
	}
}

const updateFunctionMap = {
	BASTION: updateStatusBastion,
	CIRCLE: updateStatusCircle
}

async function pollGasTransactionStatus() {
    try{
        // get records
        const {data, error} = await supabase
            .from("gas_transactions")
            .update({
                updated_at: new Date().toISOString()
            })
            .or("status.eq.SUBMITTED,status.eq.ACCEPTED,status.eq.PENDING")
            .select("*, bastionTransaction:bastion_transaction_record_id(*), circleTransaction:circle_transaction_record_id(*)")
            .order('updated_at', {ascending: true})

		if (error) throw error
		if (!data) return
		
        await Promise.all(data.map(async(transation) => {
            const updateFunction = updateFunctionMap[transation.sponsor_wallet_provider]
            if (!updateFunction) {
				await createLog("pollGasTransactionStatus", null, `No update function found for sponsor wallet provider ${transation.sponsor_wallet_provider}`, null, transation)
				return
			}
            await updateFunction(transation)
        }))
    }catch (error){
        await createLog("pollBastionGasTransaction", null, error.message, error, null)
    }
        
}

module.exports = pollGasTransactionStatus