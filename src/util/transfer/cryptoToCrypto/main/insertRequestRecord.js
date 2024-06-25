const { currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { toUnitsString } = require("../utils/toUnits");
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer");


exports.insertRequestRecord = async(requestInfo) => {
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
            contract_address: requestInfo.contractAddress
        },
    )
    .select("*")
    .single())

    if (error) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR, error.message)
    return data
        
}