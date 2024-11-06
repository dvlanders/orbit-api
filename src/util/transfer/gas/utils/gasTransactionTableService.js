const supabase = require("../../../supabaseClient")



const updateGasTransactionRecord = async(gasTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('gas_transactions')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', gasTransactionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const updateGasTransactionRecordAtomic = async(gasTransactionId, toUpdate, currentUpdatedAt) => {
    const {data, error} = await supabase
        .from('offramp_transactions')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', gasTransactionId)
        .lte('updated_at', currentUpdatedAt)
        .select()
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}   

const getGasTransactionRecord = async(gasTransactionId) => {
    const {data, error} = await supabase
        .from('gas_transactions')
        .select('*')
        .eq('id', gasTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleGasTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('gas_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleGasTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('gas_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateGasTransactionRecord,
    getGasTransactionRecord,
    insertSingleGasTransactionRecord,
    insertMultipleGasTransactionRecord,
    updateGasTransactionRecordAtomic
}