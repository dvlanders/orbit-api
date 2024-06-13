const supabase = require("../util/supabaseClient");
const { supabaseCall } = require("../util/supabaseWithRetry");
const {fieldsValidation} = require("../util/common/fieldsValidation");
const { requiredFields, acceptedFields } = require("../util/transfer/cryptoToCrypto/createTransfer");
const createLog = require("../util/logger/supabaseLogger");

exports.createCryptoToCryptoTransfer = async(req, res) => {
    if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

    // should gather senderUserId, profileId, amount, requestId, amount, recipientUserId, recipientAddress, chain
    const profileId = req.profile.id
    const fields = req.body
    const {senderUserId, amount, requestId, recipientUserId, recipientAddress, chain} = fields
    const {missingFields, invalidFields} = fieldsValidation(fields, requiredFields, acceptedFields)
    if (missingFields.length > 0 || invalidFields.length > 0) {
        return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })
	}
    if (!profileId) {
        createLog("transfer/createCryptoToCryptoTransfer", senderUserId, "No profile id found")
        return res.status(500).json({ error: "Unexpected error happened" })
    }

    // check if required fileds provided


    // check if provide either recipientUserId, recipientAddress



    // fetch information Bastion transfer needed



    // insert request record


    // transfer



    // return response
}