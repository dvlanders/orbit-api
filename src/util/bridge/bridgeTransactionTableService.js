const supabase = require("../supabaseClient")

const updateBridgeTransactionRecord = async(bridgeTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('bridge_transactions')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', bridgeTransactionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getBridgeTransactionRecord = async(bridgeTransactionId) => {
    const {data, error} = await supabase
        .from('bridge_transactions')
        .select('*')
        .eq('id', bridgeTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleBridgeTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('bridge_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleBridgeTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('bridge_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateBridgeTransactionRecord,
    getBridgeTransactionRecord,
    insertSingleBridgeTransactionRecord,
    insertMultipleBridgeTransactionRecord
}