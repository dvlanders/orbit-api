const supabase = require("../util/supabaseClient");
const { supabaseCall } = require("../util/supabaseWithRetry");
const {fieldsValidation, isUUID} = require("../util/common/fieldsValidation");
const { requiredFields, acceptedFields } = require("../util/transfer/cryptoToCrypto/utils/createTransfer");
const createLog = require("../util/logger/supabaseLogger");
const { hifiSupportedChain, currencyDecimal } = require("../util/common/blockchain");
const { isBastionKycPassed, isBridgeKycPassed } = require("../util/common/privilegeCheck");
const { fetchRequestInfortmaion } = require("../util/transfer/cryptoToCrypto/utils/fetchRequestInformation");
const { insertRequestRecord } = require("../util/transfer/cryptoToCrypto/main/insertRequestRecord");
const { toUnitsString } = require("../util/transfer/cryptoToCrypto/utils/toUnits");
const { transfer } = require("../util/transfer/cryptoToCrypto/main/transfer");
const { fetchUserWalletInformation} = require("../util/transfer/cryptoToCrypto/utils/fetchUserWalletInformation");
const { getRequestRecord } = require("../util/transfer/cryptoToCrypto/main/getRequestRecord");

exports.createCryptoToCryptoTransfer = async(req, res) => {
    if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

    // should gather senderUserId, profileId, amount, requestId, recipientUserId, recipientAddress, chain
    // const profileId = req.profile.id
    const profileId = "7cdf31e1-eb47-4b43-82f7-e368e3f6197b"
    const fields = req.body
    const currency = "usdc" // currency should only be usdc for now
    fields.currency = currency
    const {senderUserId, amount, requestId, recipientUserId, recipientAddress, chain} = fields
    try{
        const {missingFields, invalidFields} = fieldsValidation(fields, requiredFields, acceptedFields)

        // check if required fileds provided
        if (missingFields.length > 0 || invalidFields.length > 0) {
            return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })
        }
        if (!profileId) {
            createLog("transfer/createCryptoToCryptoTransfer", senderUserId, "No profile id found")
            return res.status(500).json({ error: "Unexpected error happened" })
        }

        // check if provide either recipientUserId or recipientAddress
        if (!recipientUserId && !recipientAddress) return res.status(400).json({ error: `Should provide either recipientUserId or recipientAddress`})
        if (recipientUserId && recipientAddress) return res.status(400).json({ error: `Should only provide either recipientUserId or recipientAddress`})
        // check if chain is supported
        if (!hifiSupportedChain.includes(chain)) return res.status(400).json({ error: `Chain ${chain} is not supported`})
        // fetch sender wallet address information
        if (recipientUserId) {
            const senderBastionInformation = await  fetchUserWalletInformation(senderUserId, chain)
            if (! senderBastionInformation) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user wallet record not found)`})
        }
        // check privilege
        if (!(await isBastionKycPassed(senderUserId)) || !(await isBridgeKycPassed(senderUserId))) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user status invalid)`})
        // check recipient wallet address if using recipientUserId
        if (recipientUserId){
            const recipientWalletInformation = await fetchUserWalletInformation(recipientUserId, chain)
            if (!recipientWalletInformation) return res.status(400).json({ error: `recipient wallet not found`})
            fields.recipientAddress = recipientWalletInformation.address
        }
        // check is uuid valid
        if (!isUUID(requestId)) return res.status(400).json({error: "requestId is not a valid uuid"})
        // check is request_id exist
        if (await fetchRequestInfortmaion(requestId)) return res.status(400).json({ error: `Request for requestId: ${requestId} is already exist, use get endpoint to get the status instead`})
        // peform transfer
        const receipt = await transfer(fields)

        return res.status(200).json(receipt)
    }catch (error){
        createLog("transfer/create", fields.senderUserId, error.message, error)
        return res.status(500).json({ error: `Unexpected error happened`})
    }
}

exports.getCryptoToCryptoTransfer = async(req, res) => {
    if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
    const {requestId} = req.query

    try{
        // check if requestRecord exist
        const requestRecord = await fetchRequestInfortmaion(requestId)
        if (!requestRecord) return res.status(404).json({error: "request not found"})
        // fetch up to date record
        const receipt = await getRequestRecord(requestRecord)
        return res.status(200).json(receipt)

    }catch (error){
        console.error(error)
        return res.status(500).json({error: "Unexpected error happened"})
    }





}