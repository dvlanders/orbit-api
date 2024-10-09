const cryptoToCryptoStatusMap = {
    "NOT_INITIATED": "NOT_INITIATED",
    "INITIATED": "SUBMITTED",
    "QUEUED": "PENDING",
	"PENDING_RISK_SCREENING": "PENDING",
	"SENT": "PENDING",
	"CONFIRMED": "PENDING",
	"COMPLETE": "CONFIRMED",
	"CANCELED": "CANCELED",
	"FAILED": "FAILED",
	"DENIED": "FAILED",
	"ACCELERATED": "PENDING"
}

const feeRecordStatusMap = {
    "NOT_INITIATED": "NOT_INITIATED",
    "INITIATED": "SUBMITTED",
    "QUEUED": "PENDING",
	"PENDING_RISK_SCREENING": "PENDING",
	"SENT": "PENDING",
	"CONFIRMED": "PENDING",
	"COMPLETE": "CONFIRMED",
}

const statusMapCircle = {
    "CRYPTO_TO_CRYPTO": cryptoToCryptoStatusMap,
    "FEE": feeRecordStatusMap
}

module.exports = {
    statusMapCircle
}