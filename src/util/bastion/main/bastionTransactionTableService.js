const supabase = require("../../supabaseClient")


const updateBastionTransactionRecord = async(bastionTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('bastion_transactions')
        .update({updated_at: new Date().toISOString(), ...toUpdate})
        .eq('id', bastionTransactionId)
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getBastionTransactionRecord = async(bastionTransactionId) => {
    const {data, error} = await supabase
        .from('bastion_transactions')
        .select('*')
        .eq('id', bastionTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleBastionTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('bastion_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleBastionTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('bastion_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateBastionTransactionRecord,
    getBastionTransactionRecord,
    insertSingleBastionTransactionRecord,
    insertMultipleBastionTransactionRecord
}