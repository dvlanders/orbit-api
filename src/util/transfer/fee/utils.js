const { isNumberOrNumericString } = require("../../helper/numberCheck")
const supabase = require("../../supabaseClient")

const acceptedFeeType = new Set(["PERCENT", "FIX"])

const canChargeFee = async(profileId, feeType, feeValue) => {
    if (process.env.NODE_ENV != "production") return {valid: false, error: "Fee is only available in Production environment"}

    const {data, error} = await supabase
        .from("profiles")
        .select("developer_user_id, fee_collection_enabled")
        .eq("id", profileId)
        .single()

    if (error) throw error
    if (!data.developer_user_id || !data.fee_collection_enabled) return {valid: false, error: "Please create a developer user first"}
    if (feeType && !acceptedFeeType.has(feeType)) return {valid: false, error: `Provided fee type: ${feeType} is not valid`}
    if (!isNumberOrNumericString(feeValue)) return {valid: false, error: `Fee value: ${feeValue} is not valid`}
    if (feeType && (!feeValue || parseFloat(feeValue) <= 0) ) return {valid: false, error: `Provided fee value: ${feeValue} is not valid, should be larger than 0`}
    if (feeType == "PERCENT" && parseFloat(feeValue) > 10 ) return {valid: false, error: `Provided fee value: ${feeValue} is not valid, fee value for percentage is too high, please check the fee config or contact HIFI`}
    return {valid: true}
}

const getFeeConfig = (feeType, feeValue, TrxAmount)=> {
    const feePercent = feeType == "PERCENT" ? parseFloat(feeValue) : 0
    const feeAmount = feeType == "PERCENT" ? parseFloat(TrxAmount) * feePercent : parseFloat(feeValue)

    return {feeType, feePercent, feeAmount}
}

module.exports = {
    acceptedFeeType,
    canChargeFee,
    getFeeConfig
}