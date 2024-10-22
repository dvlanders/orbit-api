const supabase = require("../../supabaseClient")




const updateReapTransactionRecord = async(reapTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('reap_transactions')
        .update(toUpdate)
        .eq('id', reapTransactionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getReapTransactionRecord = async(reapTransactionId) => {
    const {data, error} = await supabase
        .from('reap_transactions')
        .select('*')
        .eq('id', reapTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleReapTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('reap_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleReapTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('reap_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateReapTransactionRecord,
    getReapTransactionRecord,
    insertSingleReapTransactionRecord,
    insertMultipleReapTransactionRecord
}