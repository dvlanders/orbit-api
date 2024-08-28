const blindpayPayoutStatusMap = {
	"processing": "IN_PROGRESS_FIAT",
	'completed': 'COMPLETED',
	'refunded': 'FAILED_FIAT_REFUNDED',
	'failed': 'FAILED'
}

module.exports = {
    blindpayPayoutStatusMap
};