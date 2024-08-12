const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const createLog = require("../../src/util/logger/supabaseLogger");
const { updateContractActionRecord } = require("../../src/util/smartContract/updateContractActionRecord");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const notifyCryptoToCryptoTransfer = require("../../webhooks/transfer/notifyCryptoToCryptoTransfer");
const notifyDeveloperCryptoToCryptoWithdraw = require("../../webhooks/transfer/notifyDeveloperCryptoToCryptoWithdraw");
const { BASTION_URL, BASTION_API_KEY } = process.env;


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
			await createLog('pollCryptoToCryptoTransferStatus/updateStatus', contractAction.user_id, data.message, data);
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

const updateStausFuncMap = {
    "BASTION": updateBastionStatus
}

async function pollContractAction() {
	try {

		const { data: contractActions, error: contractActionsError } = await supabaseCall(() => supabase
			.from('contract_actions')
			.update({updated_at: new Date().toISOString()})
			.neq('status', "CONFIRMED")
			.neq('status', "FAILED")
			.neq('status', "CREATED")
			.order('updated_at', { ascending: true })
			.select('*')
		)


		if (contractActionsError) {
			await createLog('pollContractAction', null, contractActionsError.error, cryptoTransactionDataError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(contractActions.map(async (contractAction) => {
            const updateFunc = updateStausFuncMap[contractAction.wallet_provider]
            if (!updateFunc) {
                await createLog("pollContractAction", null, `No update function found for ${contractAction.wallet_provider}`)

            }
            await updateFunc(contractAction)
        }))
	} catch (error) {
		await createLog("pollContractAction", null, "Failed to poll Bastion crypto to crypto transfer status", error.message)
	}
}

module.exports = pollContractAction;