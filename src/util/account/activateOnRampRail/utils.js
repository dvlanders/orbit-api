const OnRampRail = {
    US_ACH: "US_ACH",
    EU_SEPA: "EU_SEPA"
}

const supportedRail = new Set([OnRampRail.US_ACH])

module.exports = {
    OnRampRail,
    supportedRail
}