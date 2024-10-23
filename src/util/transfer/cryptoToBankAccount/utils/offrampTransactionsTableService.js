const supabase = require("../../../supabaseClient")



const updateOfframpTransactionRecord = async(offrampTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('offramp_transactions')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', offrampTransactionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getOfframpTransactionRecord = async(offrampTransactionId) => {
    const {data, error} = await supabase
        .from('offramp_transactions')
        .select('*')
        .eq('id', offrampTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleOfframpTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('offramp_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleOfframpTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('offramp_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateOfframpTransactionRecord,
    getOfframpTransactionRecord,
    insertSingleOfframpTransactionRecord,
    insertMultipleOfframpTransactionRecord
}