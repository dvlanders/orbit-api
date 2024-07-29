const { virtualAccountPaymentRailToChain, chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { v4 } = require('uuid');

const circleRailCheck = async (sourceUserId, externalAccountId, sourceCurrency, destinationCurrency, chain) => {


	// check if the destination user own the external account
	let { data: circleAccount, error: circleAccountError } = await supabaseCall(() => supabase
		.from('circle_accounts')
		.select('id')
		.eq("user_id", sourceUserId)
		.eq("id", externalAccountId)
		.maybeSingle())


	if (circleAccountError) throw circleAccountError
	if (!circleAccount) return { isExternalAccountExist: false, liquidationAddress: null, liquidationAddressId: null }



	console.log('got here')

	// convert chain to the chain value required by circle



	try {

		// get the deposit address from circle
		const headers = {
			'Accept': 'application/json',
			'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
			'Content-Type': 'application/json'
		};

		const circleDepositAddressUrl = `${process.env.CIRCLE_URL}/businessAccount/wallets/addresses/deposit`;
		const circleDepositAddressResponse = await fetch(circleDepositAddressUrl, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify({
				idempotencyKey: v4(),
				currency: sourceCurrency,
				chain: chain
			})
		});

		console.log('circleDepositAddressResponse', circleDepositAddressResponse)

		if (!circleDepositAddressResponse.ok) {
			const circleDepositAddressResponseData = await circleDepositAddressResponse.json();
			console.log('circleDepositAddressResponseData error', circleDepositAddressResponseData)
			await createLog("account/createCircleWireBankAccount", userId, circleDepositAddressResponseData.message, circleDepositAddressResponseData)
			return { circleAccountExists: false, circleDepositAddress: null }
		}

		const circleDepositAddressResponseData = await circleDepositAddressResponse.json();
		console.log('circleDepositAddressResponseData', circleDepositAddressResponseData)



		return { circleAccountExists: true, circleDepositAddress: circleDepositAddressResponse.data.address }
	} catch (error) {
		console.log('error', error)
		await createLog("account/createCircleWireBankAccount", userId, error.message, error)
		return { circleAccountExists: false, circleDepositAddress: null }
	}


}

module.exports = circleRailCheck