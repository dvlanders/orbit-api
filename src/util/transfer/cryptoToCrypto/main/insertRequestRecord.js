const { currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { toUnitsString } = require("../utils/toUnits");
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer");


exports.insertRequestRecord = async(requestInfo) => {

    // get billing tags
    const billingTags = requestInfo.recipientUserId ? {
        success: ["internal"],
        failed: [],
    } : {
        success: ["external"],
        failed: [""],
    }

    const { data, error } = await supabaseCall(() => supabase
    .from('crypto_to_crypto')
    .update(
        { 
            sender_user_id: requestInfo.senderUserId,
            amount: requestInfo.amount,
            recipient_user_id: requestInfo.recipientUserId ? requestInfo.recipientUserId : null,
            recipient_address: requestInfo.recipientAddress,
            sender_address: requestInfo.senderAddress,
            chain: requestInfo.chain,
            units_amount: requestInfo.unitsAmount,
            currency: requestInfo.currency,
            contract_address: requestInfo.contractAddress,
            provider: requestInfo.senderWalletProvider,
            transfer_from_wallet_type: requestInfo.senderWalletType,
            transfer_to_wallet_type: requestInfo.recipientWalletType,
            status: "CREATED",
            bastion_user_id: requestInfo.senderBastionUserId,
            sender_bastion_user_id: requestInfo.senderBastionUserId,
            recipient_bastion_user_id: requestInfo.recipientBastionUserId,
            billing_tags_success: billingTags.success,
            billing_tags_failed: billingTags.failed,
            fee_transaction_id: requestInfo.feeTransactionId,
            circle_transaction_record_id: requestInfo.circleTransactionId,
            bastion_request_id: requestInfo.bastionRequestId,
        },
    )
    .eq('request_id', requestInfo.requestId)
    .select("*")
    .single())

    if (error) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR, error.message)
    return data
        
}