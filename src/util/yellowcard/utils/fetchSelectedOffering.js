const createLog = require('../../logger/supabaseLogger');
const { supabaseCall } = require('../../supabaseWithRetry');
const supabase = require('../../supabaseClient');

const ycDid = process.env.YC_PFI_DID;


// Fetches offerings from a specific PFI and returns a selected offering based on currency pair.
async function fetchSelectedOffering(sourceCurrency, destinationCurrency) {

	//convert sourceCurrency and destinationCurrency to uppercase
	sourceCurrency = sourceCurrency.toUpperCase();
	destinationCurrency = destinationCurrency.toUpperCase();

	const { TbdexHttpClient } = await import('@tbdex/http-client');
	const ycDid = process.env.YC_PFI_DID;

	const offerings = await TbdexHttpClient.getOfferings({ pfiDid: ycDid });

	if (!offerings || offerings.length === 0) {
		return {
			foundOfferings: false,
			selectedOffering: null,
			payin: null,
			payout: null
		}
	}

	// Filter offerings based on the currency pair
	const selectedOffering = offerings.find(offering =>
		offering.data.payin.currencyCode === sourceCurrency &&
		offering.data.payout.currencyCode === destinationCurrency
	);

	if (!selectedOffering) {
		return {
			foundOfferings: true,
			selectedOffering: null,
			payin: null,
			payout: null
		}
	}
	return {
		foundOfferings: true,
		selectedOffering: selectedOffering,
		payin: selectedOffering.data.payin,
		payout: selectedOffering.data.payout
	}
}


module.exports = {
	fetchSelectedOffering
}