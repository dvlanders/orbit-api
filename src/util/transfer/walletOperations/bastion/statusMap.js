const cryptoToCryptoStatusMap = {
    "SUBMITTED": "SUBMITTED",
    "PENDING": "PENDING",
	"FAILED": "FAILED",
	"NOT_INITIATED": "NOT_INITIATED",
	"CONFIRMED": "CONFIRMED",
	"ACCEPTED": "SUBMITTED"
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
    "FEE": feeRecordStatusMap
}

module.exports = {
    statusMapBastion
}