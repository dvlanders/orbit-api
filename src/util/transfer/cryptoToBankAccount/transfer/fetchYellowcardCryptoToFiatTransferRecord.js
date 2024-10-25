const { getYellowcardAccountDetails } = require("../../../yellowcard/utils/getYellowcardAccountDetails")
const { transferType } = require("../../utils/transfer")
const { fetchCryptoToFiatRequestInfortmaionById } = require("../utils/fetchRequestInformation")
const { convertKeysToCamelCase } = require("../../../utils/object")

const fetchYellowcardCryptoToFiatTransferRecord = async (id, profileId) => {
	// get transactio record
	const record = await fetchCryptoToFiatRequestInfortmaionById(id, profileId, "YELLOWCARD", "BASTION")
	if (!record) return null
	const yellowcardTransferInfo = record.yellowcard_transfer_info;
	const ycData = yellowcardTransferInfo.yellowcard_rfq_response?.data;
	const accountInfo = await getYellowcardAccountDetails(record.destination_account_id)

	const conversionRate = record.conversion_rate ? record.conversion_rate : null
    const quoteInformation = conversionRate ? {
        fromCurrency: conversionRate.fromCurrency,
        toCurrency: conversionRate.toCurrency,
        vaildFrom: conversionRate.vaildFrom,
        vaildUntil: conversionRate.vaildUntil,
        sendingAmount: ycData?.payin?.total,
        receivingAmount: ycData?.payout?.total,
    } : null
	const result = {
		transferType: transferType.CRYPTO_TO_FIAT,
		transferDetails: {
			id: record.id,
			requestId: record.request_id,
			sourceUserId: record.user_id,
			destinationUserId: record.destination_user_id,
			chain: record.chain,
			sourceCurrency: record.source_currency,
			amount: record.amount,
			destinationCurrency: record.destination_currency,
			liquidationAddress: record.to_wallet_address,
			destinationAccountId: record.destination_account_id,
			transactionHash: record.transaction_hash,
			createdAt: record.created_at,
			updatedAt: record.updated_at,
			status: record.transaction_status,
			contractAddress: record.contract_address,
			sourceUser: convertKeysToCamelCase(record.source_user.user_kyc),
			destinationUser: convertKeysToCamelCase(record.destination_user.user_kyc),
			destinationAccount: convertKeysToCamelCase(accountInfo),
			failedReason: record.failed_reason,
			fee: record.developer_fees ? {
				feeId: record.developer_fees.id,
				feeType: record.developer_fees.fee_type,
				feeAmount: record.developer_fees.fee_amount,
				feePercent: record.developer_fees.fee_percent,
				status: record.developer_fees.charged_status,
				transactionHash: record.developer_fees.transaction_hash,
				failedReason: record.developer_fees.failed_reason
			} : null,
			conversionRate: conversionRate,
			quoteInformation: quoteInformation ? quoteInformation : null
		}

	}

	return result
}

module.exports = fetchYellowcardCryptoToFiatTransferRecord