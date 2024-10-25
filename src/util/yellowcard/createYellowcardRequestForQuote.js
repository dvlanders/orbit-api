const createLog = require('../logger/supabaseLogger');
const { supabaseCall } = require('../supabaseWithRetry');
const supabase = require('../supabaseClient');
const { getYellowcardAccountDetails } = require('./utils/getYellowcardAccountDetails');
const { fetchSelectedOffering } = require('./utils/fetchSelectedOffering');
const { getBearerDid } = require('./utils/getBearerDid');
const fetchYellowcardCryptoToFiatTransferRecord = require("../../util/transfer/cryptoToBankAccount/transfer/fetchYellowcardCryptoToFiatTransferRecord");
const { safeToNumberString } = require('../utils/number');


async function createYellowcardRequestForQuote(destinationUserId, destinationAccountId, amount, destinationCurrency, sourceCurrency, description, purposeOfPayment) {


	const { TbdexHttpClient, Rfq, Quote, Order, OrderStatus, Close, Message } = await import('@tbdex/http-client');
	const { VerifiableCredential, PresentationExchange } = await import('@web5/credentials');
	const { DidDht, BearerDid } = await import('@web5/dids');
	// get payout account details
	const { payoutAccountDetails } = await getYellowcardAccountDetails(destinationAccountId)

	if (!payoutAccountDetails) {
		throw new Error('No payout account details found');
	}


	// const result = fetchYellowcardCryptoToFiatTransferRecord(initialTransferRecord.id, profileId);

	// let bankKind = result.transferDetails.destinationAccount.kind;

	// Retrieve the selected offering using the fetchSelectedOffering utility
	const { foundOfferings, selectedOffering, payin, payout } = await fetchSelectedOffering(sourceCurrency, destinationCurrency);
	console.log("*************payin", payin)
	// no quote found
	if (!foundOfferings) {
		return { yellowcardRequestForQuote: null, foundOfferings: false }
	}

	const yellowcardIssuedVerifiableCredentialToHifi = process.env.YC_CREDENTIAL_VC
	// Select the credentials to be used for the exchange
	const selectedCredentials = PresentationExchange.selectCredentials({
		// TODO: store this as an envar ro
		vcJwts: [yellowcardIssuedVerifiableCredentialToHifi],
		presentationDefinition: selectedOffering.data.requiredClaims
	});

	// convert amount to string with 2 decimal places
	amount = safeToNumberString(amount, 2);

	const rfqData = {
		offeringId: selectedOffering.metadata.id,
		payin: {
			// TODO: right now we assume there is only one method for payin and payout
			kind: payin.methods[0].kind,
			amount: amount,
		},
		payout: {
			kind: payoutAccountDetails.kind || payout.methods[0].kind,
			paymentDetails: {
				accountNumber: payoutAccountDetails.account_number,
				reason: purposeOfPayment,
				accountHolderName: payoutAccountDetails.account_holder_name,
			}
		},
		claims: selectedCredentials
	};

	if (payoutAccountDetails.account_holder_phone) {
		rfqData.payout.paymentDetails.phoneNumber = payoutAccountDetails.account_holder_phone;
	}

    if (payoutAccountDetails.bank_name) {
        rfqData.payout.paymentDetails.bankName = payoutAccountDetails.bank_name;
    }

	const rfqMetadata = {
		to: selectedOffering.metadata.from,
		from: process.env.HIFI_DECENTRALIZED_ID,
		protocol: '1.0'
	};

	const ycRfq = Rfq.create({
		metadata: rfqMetadata,
		data: rfqData,
	});

	const bearerDid = await getBearerDid();
	// console.log('rfq:', rfq);
	await ycRfq.sign(bearerDid);

	// create the exchange
	try {
		await TbdexHttpClient.createExchange(ycRfq);
	} catch (error) {
		await createLog("createYellowcardRequestForQuote", null, error.message, error )
		throw new Error("Failed to create exchange for createYellowcardRequestForQuote")
	}

	//poll for quote
	let quote;
	let close;
	let exchange;
	let timeout = 0;
	//Wait for Quote message to appear in the exchange
	while (!quote && timeout < 60) {
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
				timeout += 2;
			}
		}
	}

	return { yellowcardRequestForQuote: quote };
}

module.exports = createYellowcardRequestForQuote