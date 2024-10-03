const createLog = require('../../util/logger/supabaseLogger');
const { supabaseCall } = require('../../util/supabaseWithRetry');
const supabase = require('../../util/supabaseClient');
const { getYellowcardAccountDetails } = require('./utils/getYellowcardAccountDetails');




async function createYellowcardRequestForQuote(destinationUserId, destinationAccountId, receivedAmount, destinationCurrency, sourceCurrency, description, purposeOfPayment) {


	// get payout account details
	const payoutAccountDetails = await getYellowcardAccountDetails(destinationAccountId)

	// // look up the account id on the momo-mpesa account table
	// const { data: momoMpesaAccount, error: momoMpesaAccountError } = await supabaseCall(() => supabase
	// 	.from('momo_mpesa_accounts')
	// 	.select('*')
	// 	.eq('id', internalAccountId)
	// 	.single()

	// )

	// if (momoMpesaAccountError) {
	// 	createLog('error', momoMpesaAccountError)
	// 	throw new Error('Error fetching momo mpesa account')
	// }


	// TODO: need to pull these from env vars depending on dev or prod
	const yellowcardOfferingMapping = {
		USDC: {
			KES: 'offering_01j8thhe0pf6jaybgd00y7ht40',
			NGN: 'offering_01j8thhdvyen0tvwsax18ncvsm',
			UGX: 'offering_01j8thhdwge439bksxmz9mmrza',
			TZS: 'offering_01j8thhdzsf8ztn24fk0hxngrs',
			MWK: 'offering_01j8thhe1ae1mbje0vrp6fgavy',
			RWF: 'offering_01j8thhe1nem19shxxa14bwhc0',
			XAF: 'offering_01j8thhe1yfvdre4s2cdk9cs5y',
			ZMW: 'offering_01j8thhe2me59tjaedajeghpge'
		}
	}


	const { TbdexHttpClient, Rfq, Quote, Order, OrderStatus, Close, Message } = await import('@tbdex/http-client');
	const { VerifiableCredential, PresentationExchange } = await import('@web5/credentials');
	const { DidDht, BearerDid } = await import('@web5/dids');

	const ycDid = process.env.YC_PFI_DID;
	const offerings = await TbdexHttpClient.getOfferings({ pfiDid: ycDid });
	if (!offerings) {
		throw new Error('Error fetching offerings');
	}

	const offeringId = yellowcardOfferingMapping[paymentConfig.sourceCurrency]?.[paymentConfig.destinationCurrency];

	const selectedOffering = offerings.find(offering => offering.metadata.id === offeringId);

	if (!selectedOffering) {
		throw new Error('No offering found for the selected payment pair');
	}

	const yellowcardIssuedVerifiableCredential = process.env.YC_CREDENTIAL_VC


	const presentationDefinition = selectedOffering.data.requiredClaims
	// Select the credentials to be used for the exchange
	const selectedCredentials = PresentationExchange.selectCredentials({
		vcJwts: ["eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDpkaHQ6aG8zYXhwNXBncDRrOGE3a3F0Yjhrbm41dWFxd3k5Z2hrbTk4d3J5dG5oNjdic243ZXpyeSMwIn0.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vdzNpZC5vcmcvdmMvc3RhdHVzLWxpc3QvMjAyMS92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImlkIjoidXJuOnV1aWQ6YzMwZTYxOWItNGYyZC00OGY2LTkzMmQtMDlkNTRkODVmN2EyIiwiaXNzdWVyIjoiZGlkOmRodDpobzNheHA1cGdwNGs4YTdrcXRiOGtubjV1YXF3eTlnaGttOTh3cnl0bmg2N2JzbjdlenJ5IiwiaXNzdWFuY2VEYXRlIjoiMjAyNC0wOS0wNlQwNzo0ODowM1oiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpkaHQ6b244bzNyZWFkNnRrMWZ1ZWFkamVlM3IxOGJhbmI1dGozazh4YXRrZmpxMWc2cjllemR0byJ9fSwibmJmIjoxNzI1NjA4ODgzLCJqdGkiOiJ1cm46dXVpZDpjMzBlNjE5Yi00ZjJkLTQ4ZjYtOTMyZC0wOWQ1NGQ4NWY3YTIiLCJpc3MiOiJkaWQ6ZGh0OmhvM2F4cDVwZ3A0azhhN2txdGI4a25uNXVhcXd5OWdoa205OHdyeXRuaDY3YnNuN2V6cnkiLCJzdWIiOiJkaWQ6ZGh0Om9uOG8zcmVhZDZ0azFmdWVhZGplZTNyMThiYW5iNXRqM2s4eGF0a2ZqcTFnNnI5ZXpkdG8iLCJpYXQiOjE3MjU2MDg4ODN9.Cm-_3-TMmfRZFCVs0Xdt-YYTVwyBeYuR644_Ly4Svj3S5JmlrNGM4tT30G1hZRQl7po0WNsUNmYOEgX5sEItDQ"], // array of JWTs after YC actually issues the credentials
		presentationDefinition: selectedOffering.data.requiredClaims
	});

	console.log('selectedCredentials:', selectedCredentials);

	// convert paymentConfig.sourceAmount to string
	amount = paymentConfig.amount.toString();


	const rfqData = {
		offeringId: selectedOffering.metadata.id,
		payin: {
			kind: "USDC_LEDGER",
			amount: amount,
		},
		payout: {
			kind: 'MOMO_MPESA',
			paymentDetails: {
				accountNumber: momoMpesaAccount.account_number,
				reason: paymentConfig.purposeOfPayment,
				accountHolderName: momoMpesaAccount.account_holder_name,
			}
		},
		claims: selectedCredentials
	};

	const rfqMetadata = {
		to: selectedOffering.metadata.from,
		from: process.env.HIFI_DECENTRALIZED_ID,
		protocol: '1.0'
	};

	const ycRfq = Rfq.create({
		metadata: rfqMetadata,
		data: rfqData,
	});

	// FIXME: In the future, we will want to get the portable did from a secrets manager instead of storing it in the DB
	const { data: hifiDidRecord, error: hifiDidError } = await supabaseCall(() => supabase
		.from('tbd_decentralized_identifiers')
		.select('*')
		.eq('id', '62713295-5b49-4b9f-b940-b770b49e8b19')
		.single()
	)

	if (hifiDidError) {
		createLog('error', hifiDidError)
		throw new Error('Error fetching hifi did')
	}
	console.log('hifiDid', hifiDidRecord)

	// console.log('rfq:', ycRfq);
	const bearerDid = await BearerDid.import({ portableDid: hifiDidRecord.portable_did });
	// console.log('rfq:', rfq);
	await ycRfq.sign(bearerDid);


	console.log('got here')
	try {
		console.log('****************ycRfq right before exchange:', ycRfq)
		// create the exchange
		await TbdexHttpClient.createExchange(ycRfq);

	} catch (error) {
		console.error('Error creating exchange:', error);
		//log details
		console.error("error details:", error.details);

		return res.status(500).json({ error: error });
	}

	//poll for quote
	let quote;
	let close;
	let exchange;
	console.log("ycRfq.exchangeId", ycRfq.exchangeId);
	//Wait for Quote message to appear in the exchange
	while (!quote) {
		try {
			exchange = await TbdexHttpClient.getExchange({
				pfiDid: ycRfq.metadata.to,
				did: bearerDid,
				exchangeId: ycRfq.exchangeId
			});

		} catch (error) {
			console.error('Error during getExchange:', error);
			return res.status(500).json({ error: error });
		}

		quote = exchange.find(msg => msg instanceof Quote);
		console.log('************found quote:', quote);

		if (!quote) {
			// Make sure the exchange is still open
			close = exchange.find(msg => msg instanceof Close);
			console.log('************found close:', close);
			if (close) { break; }
			else {
				// Wait 2 seconds before making another request
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		}
	}

	console.log('quote:', quote);


	return quote;
}

module.exports = createYellowcardRequestForQuote