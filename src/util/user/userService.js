const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const getUserRecord = async (userId) => {
    const { data, error } = await supabaseCall(() => supabase
        .from('users')
        .select()
        .eq('id', userId)
        .maybeSingle());
    if (error) throw error;
    return data;
}

const insertUserRecord = async (toInsert) => {
    const { data, error } = await supabaseCall(() => supabase
        .from('users')
        .insert(toInsert)
        .select()
        .single());
    if (error) throw error;
    return data;
}

const insertUserKycRecord = async (toInsert) => {
    const { data, error } = await supabaseCall(() => supabase
        .from('user_kyc')
        .insert(toInsert)
        .select()
        .single());
    if (error) throw error;
    return data;
}

const updateUserRecord = async (userId, toUpdate) => {
    const { data, error } = await supabaseCall(() => supabase
        .from('users')
        .update(toUpdate)
        .eq('id', userId)
        .select()
        .single());

    if (error) throw error;
    return data;
}

const updateUserKycRecord = async (userId, toUpdate) => {
    const { data, error } = await supabaseCall(() => supabase
        .from('user_kyc')
        .update(toUpdate)
        .eq('user_id', userId)
        .select()
        .single());

    if (error) throw error;
    return data;
}


module.exports = {
    insertUserRecord,
    insertUserKycRecord,
    getUserRecord,
    updateUserRecord,
    updateUserKycRecord
}