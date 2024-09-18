const createLog = require('../../util/logger/supabaseLogger');
const { supabaseCall } = require('../../util/supabaseWithRetry');
const supabase = require('../../util/supabaseClient');



async function createDecentralizedIdentifier(userId) {
	const { DidDht } = await import('@web5/dids');

	try {
		const didDht = await DidDht.create({ publish: true });
		const portableDid = await didDht.export();

		// Save the DID record to the database
		const { data, error } = await supabaseCall(() => supabase
			.from('tbd_decentralized_identifiers')
			.insert({
				user_id: userId,
				did: didDht.uri,
				portable_did: portableDid,
				did_dht: didDht,
			})
			.single());

		if (error) {
			await createLog("util/createDecentralizedIdentifier", userId, error)
			console.error('Error creating DID:', error);
			throw new Error("An unexpected error occurred while creating DID");
		}
	} catch (error) {
		await createLog("util/createDecentralizedIdentifier", userId, error)
		console.error('Error creating DID:', error);
		throw new Error("An unexpected error occurred while creating DID");
	}



	return;
}

module.exports = createDecentralizedIdentifier