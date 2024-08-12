const supabase = require("../supabaseClient")

const getBillingPeriod = async(profileId) => {
    const {data: customer, error: customerError} = await supabase
        .from("billing_information")
        .select("next_billing_period_start, next_billing_period_end")
        .eq("profile_id", profileId)
        .maybeSingle()
    
    if (customerError) throw customerError
    if (!customer) throw new Error(`No billing information found for profileId: ${profileId}`)
    
    return {startDate: new Date(customer.next_billing_period_start).toISOString(), endDate: new Date(customer.next_billing_period_end).toISOString()}
}

module.exports = getBillingPeriod