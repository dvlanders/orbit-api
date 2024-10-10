const cryptoToCryptoStatusMap = {
    "SUBMITTED": "SUBMITTED",
    "PENDING": "PENDING",
	"FAILED": "FAILED",
	"NOT_INITIATED": "NOT_INITIATED",
	"CONFIRMED": "CONFIRMED",
	"ACCEPTED": "SUBMITTED"
}

const cryptoToFiatStatusMap = {
    "SUBMITTED": "SUBMITTED_ONCHAIN",
    "PENDING": "SUBMITTED_ONCHAIN",
	"FAILED": "FAILED_ONCHAIN",
	"NOT_INITIATED": "NOT_INITIATED",
	"CONFIRMED": "COMPLETED_ONCHAIN",
	"ACCEPTED": "SUBMITTED_ONCHAIN"
}

const feeRecordStatusMap = {
    "SUBMITTED": "SUBMITTED",
    "PENDING": "PENDING",
	"FAILED": "FAILED",
	"NOT_INITIATED": "NOT_INITIATED",
	"CONFIRMED": "CONFIRMED",
	"ACCEPTED": "SUBMITTED"
}

const statusMapBastion = {
    "CRYPTO_TO_CRYPTO": cryptoToCryptoStatusMap,
    "FEE": feeRecordStatusMap,
    "CRYPTO_TO_FIAT": cryptoToFiatStatusMap
}

module.exports = {
    statusMapBastion
}