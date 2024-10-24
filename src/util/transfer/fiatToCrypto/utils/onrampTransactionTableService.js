const supabase = require("../../../supabaseClient")



const updateOnrampTransactionRecord = async(onrampTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('onramp_transactions')
        .update({updated_at: new Date().toISOString(), ...toUpdate})
        .eq('id', onrampTransactionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getOnrampTransactionRecord = async(onrampTransactionId) => {
    const {data, error} = await supabase
        .from('onramp_transactions')
        .select('*')
        .eq('id', onrampTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleOnrampTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('onramp_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleOnrampTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('onramp_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateOnrampTransactionRecord,
    getOnrampTransactionRecord,
    insertSingleOnrampTransactionRecord,
    insertMultipleOnrampTransactionRecord
}