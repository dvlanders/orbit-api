const supabase = require("../../supabaseClient")


const updateDeveloperFeeRecord = async(developerFeeId, toUpdate) => {
    const {data, error} = await supabase
        .from('developer_fees')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', developerFeeId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const updateDeveloperFeeRecordAtomic = async(developerFeeId, toUpdate, currentUpdatedAt) => {
    const {data, error} = await supabase
        .from('developer_fees')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', developerFeeId)
        .lte('updated_at', currentUpdatedAt)
        .select()
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}   

const getDeveloperFeeRecord = async(developerFeeId) => {
    const {data, error} = await supabase
        .from('developer_fees')
        .select('*')
        .eq('id', developerFeeId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleDeveloperFeeRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('developer_fees')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleDeveloperFeeRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('developer_fees')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateDeveloperFeeRecord,
    getDeveloperFeeRecord,
    insertSingleDeveloperFeeRecord,
    insertMultipleDeveloperFeeRecord,
    updateDeveloperFeeRecordAtomic
}