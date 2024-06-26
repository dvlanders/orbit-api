const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer");

exports.updateRequestRecord = async(id, requestInfo) => {

    const { data, error } = await supabaseCall(() => supabase
    .from('crypto_to_crypto')
    .update({ 
        ...requestInfo,
        updated_at: new Date().toISOString(),
    },)
    .eq('id', id)
    .select("*")
    .single()
    )

    if (error) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR, error.message)
    return data
        
}