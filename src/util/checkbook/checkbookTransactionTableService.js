const supabase = require("../supabaseClient")

const updateCheckbookTransactionRecord = async(checkbookTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('checkbook_transactions')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', checkbookTransactionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getCheckbookTransactionRecord = async(checkbookTransactionId) => {
    const {data, error} = await supabase
        .from('checkbook_transactions')
        .select('*')
        .eq('id', checkbookTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertCheckbookTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('checkbook_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateCheckbookTransactionRecord,
    getCheckbookTransactionRecord,
    insertCheckbookTransactionRecord
}