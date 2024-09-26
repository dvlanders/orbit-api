const { getBastionWallet } = require("../../util/bastion/utils/getBastionWallet")
const { Chain } = require("../../util/common/blockchain")
const { isUUID, fieldsValidation } = require("../../util/common/fieldsValidation")
const { isValidAmount, inStringEnum } = require("../../util/common/filedValidationCheckFunctions")
const createLog = require("../../util/logger/supabaseLogger")
const { checkIsBaseAssetTransactionRequestIdAlreadyUsed } = require("../../util/transfer/baseAsset/fetchRequestInformation")
const { createBaseAssetTransfer } = require("../../util/transfer/baseAsset/withdrawGasToWallet")

exports.withdrawFromGasWallet = async(req, res) => {
    const {profileId} = req.query
    const fields = req.body
    fields.profileId = profileId
    const {amount, recipientAddress, chain, senderUserId, requestId} = fields

    try{
        // field validation
        const requiredFields = ["amount", "recipientAddress", "chain", "senderUserId", "requestId"]
        const acceptedFields = {
            amount: "string",
            recipientAddress: "string",
            chain: (value) => inStringEnum(value, [Chain.ETHEREUM_MAINNET, Chain.ETHEREUM_TESTNET]),
            senderUserId: (value) => isUUID(value),
            requestId: (value) => isUUID(value),
        }
        const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		}
        // check request id
        const { isAlreadyUsed, newRecord } = await checkIsBaseAssetTransactionRequestIdAlreadyUsed(requestId, profileId)
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })

        // get sender bastion user info
        const {walletAddress, bastionUserId} = await getBastionWallet(senderUserId, chain, "GAS_STATION")
        if (!walletAddress || !bastionUserId) return res.status(400).json({error: `Gas station wallet is not created yet`})
        fields.senderBastionUserId = bastionUserId
        fields.senderAddress = walletAddress
        
        // transfer
        const result = await createBaseAssetTransfer(fields)
        return res.status(200).json(result)
        
    }catch (error){
        await createLog("dashboard/developer/withdrawFromGasWallet", senderUserId, error.message, error, profileId)
        return res.status(500).json({error: "Unexpected error happened"})
    }
}