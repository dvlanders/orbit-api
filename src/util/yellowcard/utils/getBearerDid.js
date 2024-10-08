const createLog = require('../../logger/supabaseLogger');
const { supabaseCall } = require('../../supabaseWithRetry');
const supabase = require('../../supabaseClient');

const ycDid = process.env.YC_PFI_DID;


// Fetches offerings from a specific PFI and returns a selected offering based on currency pair.
async function getBearerDid() {

	const { BearerDid } = await import('@web5/dids');

	// FIXME: We should really be storing and getting HIFI's centralized DID from a key manager. The reason why we don't store it as a env var is because the portable DID is a json and it's too long to store as an env var
	const { data: hifiDidRecord, error: hifiDidError } = await supabase
		.from('tbd_decentralized_identifiers')
		.select('*')
		.eq('did', 'did:dht:on8o3read6tk1fueadjee3r18banb5tj3k8xatkfjq1g6r9ezdto')
		.maybeSingle()


	if (hifiDidError) {
		createLog('error', hifiDidError)
		throw new Error('Error fetching hifi did')
	}

	const bearerDid = await BearerDid.import({ portableDid: hifiDidRecord.portable_did });

	return bearerDid;
}


module.exports = {
	getBearerDid
}