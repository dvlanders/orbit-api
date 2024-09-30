const createLog = require('../../util/logger/supabaseLogger');
const { supabaseCall } = require('../../util/supabaseWithRetry');
const supabase = require('../../util/supabaseClient');




async function createRfq(userId, did, offerings, payinCurrencyCode, payoutCurrencyCode) {
	const matchedOfferings = offerings.filter(offering =>
		offering.data.payin.currencyCode === payinCurrencyCode &&
		offering.data.payout.currencyCode === payoutCurrencyCode
	);
	const selectedOffering = matchedOfferings.find(offering => offering.metadata.id === 'offering_01j60vgcygettvse30t5vxr6zt');

	const { Rfq, PresentationExchange } = await import('@tbdex/http-client');
	const selectedCredentials = PresentationExchange.selectCredentials({
		vcJwts: [/* JWTs go here */],
		presentationDefinition: selectedOffering.data.requiredClaims
	});

	const rfqData = {
		offeringId: selectedOffering.metadata.id,
		payin: {
			kind: "USDC_LEDGER",
			amount: "10",
		},
		payout: {
			kind: 'MOMO_MPESA',
			paymentDetails: {
				accountNumber: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				reason: 'Test payout',
				accountHolderName: 'Sam Yoon',
			}
		},
		claims: selectedCredentials
	};

	const rfqMetadata = {
		to: selectedOffering.metadata.from,
		from: did,
		protocol: '1.0'
	};

	const ycRfq = Rfq.create({
		metadata: rfqMetadata,
		data: rfqData,
	});

	return ycRfq;
}