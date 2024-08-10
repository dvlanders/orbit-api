const { currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { toUnitsString } = require("../utils/toUnits");
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer");


exports.insertRequestRecord = async(requestInfo) => {
    let bastionUserId = requestInfo.senderUserId
	if (requestInfo.walletType == "FEE_COLLECTION"){
		bastionUserId = `${requestInfo.senderUserId}-FEE_COLLECTION`
	}else if (requestInfo.walletType == "PREFUNDED"){
		bastionUserId = `${requestInfo.senderUserId}-PREFUNDED`
	}

    const { data, error } = await supabaseCall(() => supabase
    .from('crypto_to_crypto')
    .insert(
        { 
            request_id: requestInfo.requestId, 
            sender_user_id: requestInfo.senderUserId,
            amount: requestInfo.amount,
            recipient_user_id: requestInfo.recipientUserId ? requestInfo.recipientUserId : null,
            recipient_address: requestInfo.recipientAddress,
            chain: requestInfo.chain,
            units_amount: requestInfo.unitsAmount,
            currency: requestInfo.currency,
            contract_address: requestInfo.contractAddress,
            provider: requestInfo.provider,
            transfer_from_wallet_type: requestInfo.walletType || "INDIVIDUAL",
            status: "CREATED",
            bastion_user_id: bastionUserId
        },
    )
    .select("*")
    .single())

    if (error) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR, error.message)
    return data
        
}