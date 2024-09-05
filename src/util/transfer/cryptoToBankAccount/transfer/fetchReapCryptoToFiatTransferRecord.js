const { fetchAccountProviders } = require("../../../account/accountProviders/accountProvidersService")
const { fetchReapAccountInformation } = require("../../../account/getAccount/main/fetchReapAccount")
const { virtualAccountPaymentRailToChain } = require("../../../bridge/utils")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { transferType } = require("../../utils/transfer")
const { fetchCryptoToFiatRequestInfortmaionById } = require("../utils/fetchRequestInformation")

const fetchReapCryptoToFiatTransferRecord = async(id, profileId) => {
    // get transactio record
    const record = await fetchCryptoToFiatRequestInfortmaionById(id, profileId, "REAP", "BASTION")
    if (!record) return null
    const account = await fetchAccountProviders(record.destination_account_id, profileId)
    const accountInfo = await fetchReapAccountInformation(null, profileId, account.account_id)
        
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
            sourceUser: record.source_user.user_kyc,
            destinationUser: record.destination_user.user_kyc,
            destinationAccount: accountInfo,
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
            conversionRate: record.conversion_rate,
            quoteInformation: record.conversion_rate ? {
                validFrom: record.conversion_rate.validFrom,
                validUntil: record.conversion_rate.validUntil,
                sendingCurrency: record.source_currency,
                sendingAmount: record.amount,
                receivingCurrency: record.destination_currency,
                receivingAmount: record.destination_currency_amount
            } : null
        }

    }

    return result
}

module.exports = fetchReapCryptoToFiatTransferRecord