const supabase = require("../../../supabaseClient")



const updateBaseAssetTransactionRecord = async(baseAssetTransactionId, toUpdate) => {
    const {data, error} = await supabase
        .from('base_asset_transactions')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', baseAssetTransactionId)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}   

const updateBaseAssetTransactionRecordAtomic = async(baseAssetTransactionId, toUpdate, currentUpdatedAt) => {
    const {data, error} = await supabase
        .from('base_asset_transactions')
        .update({...toUpdate, updated_at: new Date().toISOString()})
        .eq('id', baseAssetTransactionId)
        .lte('updated_at', currentUpdatedAt)
        .select()
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}   

const getBaseAssetTransactionRecord = async(baseAssetTransactionId) => {
    const {data, error} = await supabase
        .from('base_asset_transactions')
        .select('*')
        .eq('id', baseAssetTransactionId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

const insertSingleBaseAssetTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('base_asset_transactions')
        .insert(toInsert)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

const insertMultipleBaseAssetTransactionRecord = async(toInsert) => {
    const {data, error} = await supabase
        .from('base_asset_transactions')
        .insert(toInsert)
        .select()

    if (error) throw new Error(error.message)
    return data
}

module.exports = {
    updateBaseAssetTransactionRecord,
    getBaseAssetTransactionRecord,
    insertSingleBaseAssetTransactionRecord,
    insertMultipleBaseAssetTransactionRecord,
    updateBaseAssetTransactionRecordAtomic
}