const { supabaseCall } = require("../supabaseWithRetry");
const { BridgeCustomerStatus } = require("../bridge/utils");
const supabase = require("../supabaseClient");

const isBridgeKycPassed = async(userId) => {
    const { data: bridgeCustomer, error: bridgeCustomerError } = await supabaseCall(() => supabase
        .from('bridge_customers')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle()
    )

    if (bridgeCustomerError) throw bridgeCustomerError
    if (!bridgeCustomer) return false

    return bridgeCustomer.status == BridgeCustomerStatus.ACTIVE

}

const isBastionKycPassed = async(userId) => {
    
    const { data: bastionUser, error: bastionUserError } = await supabaseCall(() => supabase
    .from('bastion_users')
    .select('kyc_passed, jurisdiction_check_passed')
    .eq('user_id', userId)
    .maybeSingle()
    )

    if (bastionUserError) throw bastionUserError
    if (!bastionUser) return false

    return bastionUser.kyc_passed && bastionUser.jurisdiction_check_passed
}

const isBastionKycPassedDeveloperUser = async(userId, type) => {
    
    const { data: bastionUser, error: bastionUserError } = await supabaseCall(() => supabase
    .from('bastion_users')
    .select('kyc_passed, jurisdiction_check_passed')
    .eq('developer_user_id', `${userId}-${type}`)
    .maybeSingle()
    )

    if (bastionUserError) throw bastionUserError
    if (!bastionUser) return false

    return bastionUser.kyc_passed && bastionUser.jurisdiction_check_passed
}

module.exports = {
    isBastionKycPassed,
    isBridgeKycPassed,
    isBastionKycPassedDeveloperUser
}