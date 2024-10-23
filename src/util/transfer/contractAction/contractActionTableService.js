const supabase = require("../../supabaseClient")




const updateContractActionRecord = async(contractActionId, toUpdate) => {
    const {data, error} = await supabase
        .from('contract_actions')
        .update(toUpdate)
        .eq('id', contractActionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const getContractActionRecord = async(contractActionId) => {
    const {data, error} = await supabase
        .from('contract_actions')
        .select('*')
        .eq('id', contractActionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleContractActionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('contract_actions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleContractActionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('contract_actions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateContractActionRecord,
    getContractActionRecord,
    insertSingleContractActionRecord,
    insertMultipleContractActionRecord
}