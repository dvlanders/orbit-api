const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const { updateCircleTransactionRecord } = require("../../src/util/circle/main/circleTransactionTableService");
const createLog = require("../../src/util/logger/supabaseLogger");
const { updateContractActionRecord } = require("../../src/util/smartContract/updateContractActionRecord");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { safeParseBody } = require("../../src/util/utils/response");
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


const updateBastionStatus = async (contractAction) => {
	const bastionUserId = contractAction.bastion_user_id
	const url = `${BASTION_URL}/v1/user-actions/${contractAction.bastion_request_id}?userId=${bastionUserId}`;
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
        let toUpdate
		if (!response.ok) {
			await createLog('pollContractAction/updateStatus', contractAction.user_id, data.message, data);
            toUpdate = {
                bastion_response: data,
                updated_at: new Date().toISOString()
            }
		}else{
            toUpdate = {
                bastion_response: data,
                status: data.status,
                bastion_status: data.status,
                transaction_hash: data.transactionHash,
                updated_at: new Date().toISOString()
            }
        }
        await updateContractActionRecord(contractAction.id, toUpdate)


	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollContractAction/updateBastionStatus', transaction.sender_user_id, 'Failed to fetch transaction status from Bastion API', error);
	}
}

const updateCircleStatus = async (contractAction) => {
	const circleTransactionId = contractAction.circle_transaction.circle_transaction_id
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
			await createLog('pollContractAction/updateStatus', contractAction.user_id, data.message, data);
            toUpdate = {
				status: "FAILED",
                updated_at: new Date().toISOString()
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
		await Promise.all([
			updateContractActionRecord(contractAction.id, toUpdate),
			updateCircleTransactionRecord(contractAction.circle_transaction_record_id, toUpdateCircleTransaction)
		])


	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollContractAction/updateCircleStatus', contractAction.user_id, 'Failed to fetch transaction status from Bastion API', error);
	}
}

const updateStausFuncMap = {
    "BASTION": updateBastionStatus,
	"CIRCLE": updateCircleStatus
}

async function pollContractAction() {
	try {

		const { data: contractActions, error: contractActionsError } = await supabaseCall(() => supabase
			.from('contract_actions')
			.update({updated_at: new Date().toISOString()})
			.or("status.eq.SUBMITTED,status.eq.ACCEPTED,status.eq.PENDING")
			.order('updated_at', { ascending: true })
			.select('*, circle_transaction: circle_transaction_record_id(*)')
		)


		if (contractActionsError) {
			await createLog('pollContractAction', null, contractActionsError.error, contractActionsError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(contractActions.map(async (contractAction) => {
            const updateFunc = updateStausFuncMap[contractAction.wallet_provider]
            if (!updateFunc) {
                // await createLog("pollContractAction", null, `No update function found for ${contractAction.wallet_provider}`)
				return
            }
            await updateFunc(contractAction)
        }))
	} catch (error) {
		await createLog("pollContractAction", null, "Failed to poll Bastion crypto to crypto transfer status", error.message)
	}
}

module.exports = pollContractAction;