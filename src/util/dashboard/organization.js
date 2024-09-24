const supabase = require("../supabaseClient")
const { convertKeysToCamelCase } = require("../utils/object")

const getBasicInfo = async (profileId) => {
    const { data: organization, error: organizationError } = await supabase
			.from("profiles")
			.select("organization: organization_id(prod_enabled, kyb_status, developer_user_id, prefunded_account_enabled, fee_collection_enabled, billing_enabled)")
			.eq("id", profileId)
			.single()

	if (organizationError) throw organizationError
    return convertKeysToCamelCase(organization)
}

const getMembers = async(profileId) => {
    const { data: members, error: membersError } = await supabase
			.from("profiles")
			.select("id, full_name, email, organization_role, avatar_url")
			.eq("organization_id", profileId)

	if (membersError) throw membersError
    members.sort((a, b) => {
        if (a.organization_role < b.organization_role) {
            return -1;
        }
        if (a.organization_role > b.organization_role) {
            return 1;
        }
        return 0;
    });
    return convertKeysToCamelCase(members)
}

const getBillingInformation = async(profileId) => {
    const { data: billingInformation, error: billingInformationError } = await supabase
			.from("billing_information")
			.select("id, profile_id, billing_email, billing_name, stripe_default_payment_method_id, autopay, autopay_amount, autopay_threshold")
			.eq("profile_id", profileId)
			.maybeSingle()

    if (billingInformationError) throw billingInformationError
    let _billingInformation
    if (billingInformation) _billingInformation = convertKeysToCamelCase(billingInformation)
    return _billingInformation
}

const getCreditBalance = async(profileId) => {
    const {data: balance, error: balanceError} = await supabase
        .from("balance")
        .select("updated_at, balance, monthly_minimum: billing_info_id(monthly_minimum)")
        .eq("profile_id", profileId)
        .single()
    
    if (balanceError) throw balanceError
    const _balance = {
        ...balance,
        monthly_minimum: balance.monthly_minimum.monthly_minimum
    }
    return convertKeysToCamelCase(_balance)

}

const getOrganizationInformation = async(profileId) => {
    const [basicInfo, members, billingInformation, creditBalance] = await Promise.all(
        [
            getBasicInfo(profileId),
            getMembers(profileId),
            getBillingInformation(profileId),
            getCreditBalance(profileId)
        ]
    )

    const organization = {
        ...basicInfo,
		members,
		billingInformation,
        creditBalance
    }

    return organization

}

module.exports = getOrganizationInformation