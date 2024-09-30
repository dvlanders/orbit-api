const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyFiatToCryptoTransfer = require("../../webhooks/transfer/notifyFiatToCryptoTransfer");
const { chargeFeeOnFundReceivedBastion } = require("../../src/util/transfer/fiatToCrypto/transfer/chargeFeeOnFundReceived");
const { BridgeTransactionStatusMap } = require("../../src/util/bridge/utils");
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const updateStatus = async (onrampTransaction) => {
	try {

		if (!onrampTransaction.bridge_deposit_id) return

		// get user bridge Id
		const { data: bridgeUser, error: bridgeUserError } = await supabaseCall(() => supabase
			.from("bridge_customers")
			.select("bridge_id")
			.eq("user_id", onrampTransaction.destination_user_id)
			.single())

		if (bridgeUserError) throw bridgeUserError

		// fetch up to 100 actvity of this account until no more records after the last_bridge_virtual_account_event_id
		// or the transaction status is final
		let last_event_id = onrampTransaction.last_bridge_virtual_account_event_id
		while (true) {
			const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeUser.bridge_id}/virtual_accounts/${onrampTransaction.bridge_virtual_account_id}/history?limit=100&${last_event_id ? `ending_before=${last_event_id}` : ""}`, {
				method: 'GET',
				headers: {
					'Api-Key': BRIDGE_API_KEY
				}
			});

			const responseBody = await response.json();
			if (!response.ok) {
				await createLog('pollOnrampTransactionsBridgeStatus', onrampTransaction.user_id, 'Failed to fetch response from bridge', responseBody);
				return
			}

			// no activity
			if (responseBody.data <= 0) {
				break
			}
			const events = responseBody.data
			last_event_id = events[0].id

			// "description": "INDIVIDUAL Checkbook Inc [75D7C01F 5F93 4490 8B9] CHECK 5006 WILLIAM YANG 312410A2 9C1B 4337 AFEB 71DAD9DA3428"
			// try to find the latest record
			for (const event of events) {
				if(event.type === "funds_scheduled" || event.type === "microdeposit") continue

				const description = event.source.description
				const referenceId = description?.split(" ")?.slice(-5)?.join('-')?.toLowerCase()
				const depositId = event.deposit_id;
				const hasDepositId = depositId == onrampTransaction.bridge_deposit_id
				const hasReferenceId = referenceId == onrampTransaction.id

				if(hasDepositId || hasReferenceId){
					// update status, this should be the latest for this batch of records
					const { data: update, error: updateError } = await supabase
					.from("onramp_transactions")
					.update({
						bridge_response: event,
						bridge_status: event.type,
						status: event.type in BridgeTransactionStatusMap ? BridgeTransactionStatusMap[event.type] : "UNKNOWN",
						last_bridge_virtual_account_event_id: last_event_id,
						updated_at: new Date().toISOString(),
						transaction_hash: event.destination_tx_hash,
					})
					.eq(hasDepositId ? "bridge_deposit_id" : "id", hasDepositId ? depositId : referenceId) // check with deposit id if it exists, otherwise check with reference id
					.select("id, request_id, user_id, destination_user_id, bridge_virtual_account_id, amount, created_at, updated_at, status, plaid_checkbook_id, fiat_provider, crypto_provider")
					.single()
					if (updateError) throw updateError

					if (onrampTransaction.developer_fee_id) {
						await chargeFeeOnFundReceivedBastion(onrampTransaction.id)
					}

					await notifyFiatToCryptoTransfer(update)
					break

				}else{
					await createLog("pollOnrampTransactionsBridgeStatus/updateStatus", onrampTransaction.user_id, `No matching deposit id or reference id found for ${onrampTransaction.id} and ${depositId}`)
					break
				}
				
			}

		}

	} catch (error) {
		await createLog("pollOnrampTransactionsBridgeStatus/updateStatus", onrampTransaction.user_id, error.message)
		return
	}
}


async function pollOnrampTransactionsBridgeStatus() {
	// Get all records where the bridge_transaction_status is not 
	const { data: onRampTransactionStatus, error: onRampTransactionStatusError } = await supabaseCall(() => supabase
		.from('onramp_transactions')
		.select('id, user_id, bridge_virtual_account_id, destination_user_id, last_bridge_virtual_account_event_id, developer_fee_id, bridge_deposit_id')
		.eq("crypto_provider", "BRIDGE")
		.or('status.eq.FIAT_PROCESSED,status.eq.FIAT_CONFIRMED,status.eq.CRYPTO_SUBMITTED,status.eq.CRYPTO_IN_REVIEW')
		.order('updated_at', { ascending: true })
	)

	if (onRampTransactionStatusError) {
		console.error('Failed to fetch transactions for pollOnrampTransactionsBridgeStatus', onRampTransactionStatusError);
		await createLog('pollOnrampTransactionsBridgeStatus', null, onRampTransactionStatusError.message, onRampTransactionStatusError);
		return;
	}

	await Promise.all(onRampTransactionStatus.map(async (onrampTransaction) => await updateStatus(onrampTransaction)))

}

module.exports = pollOnrampTransactionsBridgeStatus
