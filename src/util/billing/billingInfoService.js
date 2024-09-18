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

const updateProfileBillingInfo = async (profileId, billingInfoUpdates) => {

    const {data, error} = await supabaseCall(() => supabase
        .from('billing_information')
        .update(billingInfoUpdates)
        .eq('profile_id', profileId)
        .select()
        .single()
    );

    if(error)throw error;
    return data;
}

const updateCustomerBillingInfo = async (customerId, billingInfoUpdates) => {

    const {data, error} = await supabaseCall(() => supabase
        .from('billing_information')
        .update(billingInfoUpdates)
        .eq('stripe_customer_id', customerId)
        .select()
        .single()
    );

    if(error)throw error;
    return data;
}

const getProfileBillingInfo = async (profileId) => {

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
    updateProfileBillingInfo,
    updateCustomerBillingInfo,
    getProfileBillingInfo
};
  