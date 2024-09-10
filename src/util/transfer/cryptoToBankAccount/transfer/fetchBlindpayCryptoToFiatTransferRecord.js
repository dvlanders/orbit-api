const { transferType } = require("../../utils/transfer")
const { fetchCryptoToFiatRequestInfortmaionById } = require("../utils/fetchRequestInformation")
const { getBankAccountInfo } = require("../../../blindpay/getBankAccountInfo")

const fetchBlindpayCryptoToFiatTransferRecord = async(id, profileId) => {

    const record = await fetchCryptoToFiatRequestInfortmaionById(id, profileId, "BLINDPAY", "BASTION");
    if (!record) return null;

    const bankAccountInfo = await getBankAccountInfo(record.to_blindpay_account_id);
    
    const conversionRate = {
        fromCurrency: record.source_currency,
        toCurrency: record.destination_currency,
        conversionRate: record.conversion_rate?.blindpay_quotation / 100,
        vaildFrom: new Date().toISOString(),
        vaildUntil: record.conversion_rate?.expires_at ? new Date(record.conversion_rate?.expires_at).toISOString() : new Date().toISOString(),
    }
    const quoteInformation = {
        fromCurrency: conversionRate.fromCurrency,
        toCurrency: conversionRate.toCurrency,
        vaildFrom: conversionRate.vaildFrom,
        vaildUntil: conversionRate.vaildUntil,
        sendingAmount: record.conversion_rate?.sender_amount / 100,
        receivingAmount: record.conversion_rate?.receiver_amount / 100,
    }

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
            destinationAccountId: bankAccountInfo.id,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.transaction_status,
            contractAddress: record.contract_address,
            sourceUser: record.source_user.user_kyc,
            destinationUser: record.destination_user.user_kyc,
            destinationAccount: bankAccountInfo,
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

    return result;
}

module.exports = fetchBlindpayCryptoToFiatTransferRecord