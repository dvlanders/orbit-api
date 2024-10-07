const createLog = require('../logger/supabaseLogger');
const { supabaseCall } = require('../supabaseWithRetry');
const supabase = require('../supabaseClient');
const { getYellowcardAccountDetails } = require('./utils/getYellowcardAccountDetails');
const { fetchSelectedOffering } = require('./utils/fetchSelectedOffering');




async function createYellowcardRequestForQuote(destinationUserId, destinationAccountId, amount, destinationCurrency, sourceCurrency, description, purposeOfPayment) {


	const { TbdexHttpClient, Rfq, Quote, Order, OrderStatus, Close, Message } = await import('@tbdex/http-client');
	const { VerifiableCredential, PresentationExchange } = await import('@web5/credentials');
	const { DidDht, BearerDid } = await import('@web5/dids');
	// get payout account details
	const { payoutAccountDetails } = await getYellowcardAccountDetails(destinationAccountId)

	if (!payoutAccountDetails) {
		throw new Error('No payout account details found');
	}

	// Retrieve the selected offering using the fetchSelectedOffering utility
	const { foundOfferings, selectedOffering, payin, payout } = await fetchSelectedOffering(sourceCurrency, destinationCurrency);




	if (!selectedOffering) {
		throw new Error('No offering found for the selected payment pair');
	}

	const yellowcardIssuedVerifiableCredentialToHifi = process.env.YC_CREDENTIAL_VC
	// Select the credentials to be used for the exchange
	const selectedCredentials = PresentationExchange.selectCredentials({
		// TODO: store this as an envar ro
		vcJwts: [yellowcardIssuedVerifiableCredentialToHifi],
		presentationDefinition: selectedOffering.data.requiredClaims
	});


	// convert amount to string
	if (!amount) {
		throw new Error('Amount is required');
	} else {
		amount = amount.toString();
	}


	const rfqData = {
		offeringId: selectedOffering.metadata.id,
		payin: {
			// FIXME: right now we assume there is only one method for payin and payout
			kind: payin.methods[0].kind,
			amount: amount,
		},
		payout: {
			// FIXME: right now we assume there is only one method for payin and payout
			kind: payout.methods[0].kind,
			paymentDetails: {
				accountNumber: payoutAccountDetails.account_number,
				reason: purposeOfPayment,
				accountHolderName: payoutAccountDetails.account_holder_name,
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
	// const { data: hifiDidRecord, error: hifiDidError } = await supabaseCall(() => supabase
	// 	.from('tbd_decentralized_identifiers')
	// 	.select('*')
	// 	.eq('id', '62713295-5b49-4b9f-b940-b770b49e8b19')
	// 	.single()
	// )

	const { data: hifiDidRecord, error: hifiDidError } = await supabase
		.from('tbd_decentralized_identifiers')
		.select('*')
		.eq('id', '62713295-5b49-4b9f-b940-b770b49e8b19')
		.maybeSingle()


	if (hifiDidError) {
		createLog('error', hifiDidError)
		throw new Error('Error fetching hifi did')
	}

	// console.log('rfq:', ycRfq);
	const bearerDid = await BearerDid.import({ portableDid: hifiDidRecord.portable_did });
	// console.log('rfq:', rfq);
	await ycRfq.sign(bearerDid);


	try {
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

		if (!quote) {
			// Make sure the exchange is still open
			close = exchange.find(msg => msg instanceof Close);
			if (close) { break; }
			else {
				// Wait 2 seconds before making another request
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		}
	}

	return { yellowcardRequestForQuote: quote };
}

module.exports = createYellowcardRequestForQuote