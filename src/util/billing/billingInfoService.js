const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");


const addBillingInfo = async (billingInfo) => {

    const {data, error} = await supabaseCall(() => supabase
        .from('billing_information')
        .upsert(billingInfo, {onConflict: 'profile_id', ignoreDuplicates: true})
        .select()
        .maybeSingle()
    );

    if(error)throw error;
    return data;
}

const updateBillingInfo = async (id, billingInfoUpdates) => {

    const {data, error} = await supabaseCall(() => supabase
        .from('billing_information')
        .update(billingInfoUpdates)
        .eq('id', id)
        .select()
        .single()
    );

    if(error)throw error;
    return data;
}

const getBillingInfo = async (profileId) => {

    const {data, error} = await supabaseCall(() => supabase
        .from('billing_information')
        .select()
        .eq('profile_id', profileId)
        .maybeSingle()
    );

    if(error)throw error;
    return data;

}

module.exports = {
    addBillingInfo,
    updateBillingInfo,
    getBillingInfo
};
  