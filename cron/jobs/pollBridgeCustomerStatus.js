const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const createBridgeVirtualAccount = require('../../src/util/bridge/endpoint/createBridgeVirtualAccount');
const { getEndorsementStatus } = require('../../src/util/bridge/utils');
const notifyUserStatusUpdate = require('../../webhooks/user/notifyUserStatusUpdate');


const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const updateStatus = async (customer) => {
	try {
		const response = await fetch(`${BRIDGE_URL}/v0/customers/${customer.bridge_id}`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('Error response:', errorData);
			return res.status(response.status).json({ error: 'Failed to fetch bridge customer' });
		}

		const data = await response.json();
		const { status: baseStatus, actions: baseActions, fields: baseFields } = getEndorsementStatus(data.endorsements, "base")
		const { status: sepaStatus, actions: sepaActions, fields: sepaFields } = getEndorsementStatus(data.endorsements, "sepa")

		if (customer.status !== data.status) {
			const { error: updateError } = await supabaseCall(() => supabase
				.from('bridge_customers')
				.update({
					status: data.status,
					bridge_response: data,
					base_status: baseStatus,
					sepa_status: sepaStatus,
					updated_at: new Date().toISOString()
				})
				.eq('id', customer.id)
			)

			if (updateError) {
				console.error('Failed to update bridge customer status', updateError);
				await createLog('pollBridgeCustomerStatus', customer.user_id, 'Failed to update bridge customer status', updateError);
				return
			}
			// if (!customer.is_developer) {
			// 	await notifyUserStatusUpdate(customer.user_id)
			// }
		}
	} catch (error) {
		console.error('Failed to fetch customer status from Bridge API', error);
		await createLog('pollBridgeCustomerStatus', customer.user_id, 'Failed to fetch customer status from Bridge API', error);
	}
}

async function pollBridgeCustomerStatus() {


	const { data: bridgeCustomerData, error: bridgeCustomerError } = await supabaseCall(() => supabase
		.from('bridge_customers')
		.update({ updated_at: new Date().toISOString() })
		.or("status.eq.not_started,status.eq.incomplete,status.eq.under_review,status.eq.awaiting_ubo")
		.order('updated_at', { ascending: true })
		.select('id, user_id, status, bridge_id, users(is_developer)'))



	if (bridgeCustomerError) {
		console.error('Failed to fetch customers for pollBridgeCustomerStatus', bridgeCustomerError);
		await createLog('pollBridgeCustomerStatus', null, 'Failed to fetch customers', bridgeCustomerError);
		return;
	}

	// for each one that isn't active or rejected, get the latest status from the Bridge API and update the db
	await Promise.all(bridgeCustomerData.map(async (customer) => await updateStatus(customer)))
}

module.exports = pollBridgeCustomerStatus;
