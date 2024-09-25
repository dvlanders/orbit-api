const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;


const updateStatus = async (transaction) => {
	const url = `${BASTION_URL}/v1/crypto/transfers/${transaction.request_id}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
        const response = await fetch(url, options);
		const responseBody = await response.json();
        const toUpdate = {
            status: transaction.status,
            bastion_response: responseBody
        }

		if (!response.ok) {
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${responseBody.message || 'Unknown error'}. Bastion request Id: ${transaction.request_id}`;
			await createLog('pollCryptoToCryptoTransferStatus/updateStatus', transaction.destination_user_id, errorMessage, responseBody);
		}else{
            toUpdate.status = responseBody.status
        }

        // update status
		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
			.from('bastion_gas_station_transactions')
			.update(toUpdate)
			.eq('request_id', transaction.request_id)
			.select()
			.single())

		if (updateError) {
			console.error('Failed to update transaction status', updateError);
			await createLog('pollOfframpTransactionsBastionStatus/updateStatus', transaction.sender_user_id, 'Failed to update transaction status', updateError);
		}

	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollOfframpTransactionsBastionStatus/updateStatus', transaction.sender_user_id, error.message, error);
	}
}

async function pollBastionGasTransaction() {
    try{
        // get records
        const {data, error} = await supabase
            .from("bastion_gas_station_transactions")
            .update({
                updated_at: new Date().toISOString()
            })
            .or("status.eq.SUBMITTED,status.eq.ACCEPTED,status.eq.PENDING")
            .select("*")
            .order('updated_at', {ascending: true})

		if (error) throw error
		if (!data) return
		
        await Promise.all(data.map(async(transation) => {
            await updateStatus(transation)
        }))
    }catch (error){
        await createLog("pollBastionGasTransaction", null, error.message, error, null)
    }
        
}

module.exports = pollBastionGasTransaction