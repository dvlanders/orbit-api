const { virtualAccountPaymentRailToChain } = require("../../../bridge/utils")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { transferType } = require("../../utils/transfer")
const { fetchCryptoToFiatRequestInfortmaionById } = require("../utils/fetchRequestInformation")

const fetchBridgeCryptoToFiatTransferRecord = async(id, profileId) => {
    // get transactio record
    const record = await fetchCryptoToFiatRequestInfortmaionById(id, profileId, "BRIDGE", "BASTION")

    if (!record) return null

    // get rail information
    let { data: bridgeLiquidationAddress, error: bridgeLiquidationAddressError } = await supabaseCall(() => supabase
        .from('bridge_liquidation_addresses')
        .select('chain, currency, destination_currency, address')
        .eq("liquidation_address_id", record.to_bridge_liquidation_address_id)
        .single())

    if (bridgeLiquidationAddressError) throw bridgeLiquidationAddressError

    // get external account information

    let { data: bridgeExternalAccount, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
        .from('bridge_external_accounts')
        .select('id, account_owner_name, bank_name, account_number, routing_number, account_type, business_identifier_code, bank_country, iban, beneficiary_first_name, beneficiary_last_name')
        .eq("bridge_external_account_id", record.to_bridge_external_account_id)
        .single())

    if (bridgeExternalAccountError) throw bridgeExternalAccountError
        
    const result = {
        transferType: transferType.CRYPTO_TO_FIAT,
        transferDetails: {
            id: record.id,
            requestId: record.request_id,
            sourceUserId: record.user_id,
            destinationUserId: record.destination_user_id,
            chain: virtualAccountPaymentRailToChain[bridgeLiquidationAddress.chain],
            sourceCurrency: bridgeLiquidationAddress.currency,
            amount: record.amount,
            destinationCurrency: bridgeLiquidationAddress.destination_currency,
            liquidationAddress: bridgeLiquidationAddress.address,
            destinationAccountId: bridgeExternalAccount.id,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.transaction_status,
            contractAddress: record.contract_address,
            sourceUser: record.source_user.user_kyc,
            destinationUser: record.destination_user.user_kyc,
            destinationAccount: bridgeExternalAccount,
            failedReason: record.failed_reason,
            fee: record.developer_fees ? {
                feeId: record.developer_fees.id,
                feeType: record.developer_fees.fee_type,
                feeAmount: record.developer_fees.fee_amount,
                feePercent: record.developer_fees.fee_percent,
                status: record.developer_fees.charged_status,
                transactionHash: record.developer_fees.transaction_hash,
                failedReason: record.developer_fees.failed_reason
            } : null
        }

    }

    return result
}

module.exports = fetchBridgeCryptoToFiatTransferRecord