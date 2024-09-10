const { fetchAccountProviders } = require("../../../account/accountProviders/accountProvidersService")
const { virtualAccountPaymentRailToChain } = require("../../../bridge/utils")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { convertKeysToCamelCase } = require("../../../utils/object")
const { transferType } = require("../../utils/transfer")
const { fetchCryptoToFiatRequestInfortmaionById } = require("../utils/fetchRequestInformation")

const fetchBridgeCryptoToFiatTransferRecord = async(id, profileId) => {
    // get transactio record
    const record = await fetchCryptoToFiatRequestInfortmaionById(id, profileId, "BRIDGE", "BASTION")

    if (!record) return null
    // get external account information

    const accountInfo = await fetchAccountProviders(record.destination_account_id, profileId)

    let { data: bridgeExternalAccount, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
        .from('bridge_external_accounts')
        .select('id, account_owner_name, bank_name, account_number, routing_number, account_type, business_identifier_code, bank_country, iban, beneficiary_first_name, beneficiary_last_name')
        .eq("id", accountInfo.account_id)
        .single())

    if (bridgeExternalAccountError) throw bridgeExternalAccountError
        
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
            destinationAccount: convertKeysToCamelCase(bridgeExternalAccount),
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
            conversionRate: record.conversion_rate
        }

    }

    return result
}

module.exports = fetchBridgeCryptoToFiatTransferRecord