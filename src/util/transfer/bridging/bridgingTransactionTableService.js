const supabase = require("../../supabaseClient")



const updateBridgingTransactionRecord = async(bridgingTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('bridging_transactions')
        .update(toUpdate)
        .eq('id', bridgingTransactionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getBridgingTransactionRecord = async(bridgingTransactionId) => {
    const {data, error} = await supabase
        .from('bridging_transactions')
        .select('*')
        .eq('id', bridgingTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleBridgingTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('bridging_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleBridgingTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('bridging_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateBridgingTransactionRecord,
    getBridgingTransactionRecord,
    insertSingleBridgingTransactionRecord,
    insertMultipleBridgingTransactionRecord
}