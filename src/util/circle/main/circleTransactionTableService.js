const supabase = require("../../supabaseClient")


const updateCircleTransactionRecord = async(circleTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('circle_transactions')
        .update(toUpdate)
        .eq('id', circleTransactionId)
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getCircleTransactionRecord = async(circleTransactionId) => {
    const {data, error} = await supabase
        .from('circle_transactions')
        .select('*')
        .eq('id', circleTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleCircleTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('circle_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleCircleTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('circle_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateCircleTransactionRecord,
    getCircleTransactionRecord,
    insertSingleCircleTransactionRecord,
    insertMultipleCircleTransactionRecord
}