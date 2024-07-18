const { v4 } = require("uuid");
const { transfer } = require("../../bastion/endpoints/transfer");
const { getBastionWallet } = require("../../bastion/utils/getBastionWallet");
const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const { currencyContractAddress, currencyDecimal } = require("../../common/blockchain");
const { toUnitsString } = require("../cryptoToCrypto/utils/toUnits");

const chargedStatusMap = {
    ACCEPTED: "SUBMITTED",
    SUBMITTED: "SUBMITTED",
    CONFIRMED: "COMPLETE",
    FAILED: "FAILED",
    PENDING: "PENDING"
}

exports.chargeDeveloperFeeBastion = async(transferId, transferType, feeType, feePercent, feeAmount, chargedUserId, profileId, chain, currency) => {
    try{
        console.log(transferId, transferType, feeType, feePercent, feeAmount, chargedUserId, profileId, chain, currency)
        // get fee_collection_user_id
        const {data: feeCollectionUser, error: feeCollectionUserError} = await supabase
            .from("profiles")
            .select("developer_user_id")
            .eq("id", profileId)
            .single()

        if (feeCollectionUserError) throw feeCollectionUserError
        if (!feeCollectionUser.developer_user_id) throw new Error("Developer user account is not created")
        console.log(feeCollectionUser.developer_user_id)

        // get fee_collection_wallet_address
		const feeCollectionWalletAddress = await getBastionWallet(feeCollectionUser.developer_user_id, chain, "FEE_COLLECTION")
		if (!feeCollectionWalletAddress) throw new Error (`No feeCollectionWalletAddress wallet found`)

        // get charged user wallet address
		const chargedWalletAddress = await getBastionWallet(chargedUserId, chain)
		if (!chargedWalletAddress) throw new Error (`No user wallet found`)

        // charge 
        const decimals = currencyDecimal[currency]
        const transferAmount = toUnitsString(feeAmount, decimals)
        const requestId = v4()
        const request = {
            senderUserId: chargedUserId,
            contractAddress: currencyContractAddress[chain][currency],
            chain: chain,
            recipientAddress: feeCollectionWalletAddress,
            unitsAmount: transferAmount
        }
        const response = await transfer(requestId, request)
        const responseBody = await response.json()
        // insert record
        const record = {
            request_id: requestId,
            fee_type: feeType,
            fee_percent: feePercent,
            fee_amount: feeAmount,
            charged_user_id: chargedUserId,
            fee_collection_user_id: feeCollectionUser.developer_user_id,
            fee_collection_wallet_address: feeCollectionWalletAddress,
            fee_collection_chain: chain,
            fee_collection_currency: currency,
            crypto_provider: "BASTION",
            charged_status: "CREATED",
            charged_transfer_id: transferId,
            charged_transfer_type: transferType,
            charged_wallet_address: chargedWalletAddress,
            bastion_response: responseBody
        }

        if (response.ok){
            record.bastion_status = responseBody.status
            record.charged_status = chargedStatusMap[responseBody.status] || "UNKNOWN"
            record.transaction_hash = responseBody.transactionHash
            record.failed_reason = responseBody.failureDetails
        }else{
            createLog("transfer/fee/chargeDeveloperFeeBastion", chargedUserId, responseBody.message, responseBody)
            if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance"){
                record.failed_reason = "Transfer amount exceeds balance"
            }else{
                record.failed_reason = "Not enough gas, please contact HIFI for more information"
            }
            record.bastion_status = "FAILED"
            record.charged_status = "FAILED"
        }

        // insert record to supabase
        const {data: feeRecord, error: feeRecordError} = await  supabaseCall(() => supabase
            .from("developer_fees")
            .insert(record)
            .select("id")
            .single()
        )

        if (feeRecordError) throw feeRecordError

        return feeRecord.id

    }catch (error){
        createLog("transfer/fee/chargeDeveloperFeeBastion", chargedUserId, error.message)
        // TODO should we create a job to recharged?
        return null
    }







}