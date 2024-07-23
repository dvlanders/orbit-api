const { getBastionWallet } = require("../../bastion/utils/getBastionWallet");
const { currencyDecimal } = require("../../common/blockchain");
const supabase = require("../../supabaseClient");
const { toUnitsString } = require("../cryptoToCrypto/utils/toUnits");
const { insertFeeRecord } = require("./insertFeeRecord");

exports.createNewFeeRecord = async(transferId, feeType, feePercent, feeAmount, profileId, info, transferType, cryptoProvider) => {
    // get fee_collection_user_id
    const {data: feeCollectionUser, error: feeCollectionUserError} = await supabase
    .from("profiles")
    .select("developer_user_id")
    .eq("id", profileId)
    .single()

    if (feeCollectionUserError) throw feeCollectionUserError
    if (!feeCollectionUser.developer_user_id) throw new Error("Developer user account is not created")

    // get fee_collection_wallet_address
    const feeCollectionWalletAddress = await getBastionWallet(feeCollectionUser.developer_user_id, info.chain, "FEE_COLLECTION")
    if (!feeCollectionWalletAddress) throw new Error (`No feeCollectionWalletAddress wallet found`)

    const record = {
        fee_type: feeType,
        fee_percent: feePercent,
        fee_amount: feeAmount,
        charged_user_id: info.chargedUserId,
        fee_collection_user_id: feeCollectionUser.developer_user_id,
        fee_collection_wallet_address: feeCollectionWalletAddress,
        fee_collection_chain: info.chain,
        fee_collection_currency: info.currency,
        crypto_provider: cryptoProvider,
        charged_status: "CREATED",
        charged_transfer_id: transferId,
        charged_transfer_type: transferType,
        charged_wallet_address: info.chargedWalletAddress,
    }
    
    const feeRecord = await insertFeeRecord(record)
    return feeRecord
}