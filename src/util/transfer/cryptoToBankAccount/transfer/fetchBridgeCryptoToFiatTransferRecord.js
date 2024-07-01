const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { transferType } = require("../../utils/transfer")
const { fetchCryptoToFiatRequestInfortmaionById } = require("../utils/fetchRequestInformation")

const fetchBridgeCryptoToFiatTransferRecord = async(id) => {
    // get transactio record
    const record = await fetchCryptoToFiatRequestInfortmaionById(id)

    // get rail information
    let { data: bridgeLiquidationAddress, error: bridgeLiquidationAddressError } = await supabaseCall(() => supabase
        .from('bridge_liquidation_addresses')
        .select('chain, currency, destination_currency')
        .eq("liquidation_address_id", record.to_bridge_liquidation_address_id)
        .single())

    if (bridgeLiquidationAddressError) throw bridgeLiquidationAddressError

    // get external account information

    let { data: bridgeExternalAccount, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
        .from('bridge_external_accounts')
        .select('id')
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
            chain: bridgeLiquidationAddress.chain,
            sourceCurrency: bridgeLiquidationAddress.currency,
            amount: record.amount,
            destinationCurrency: bridgeLiquidationAddress.destination_currency,
            destinationAccountId: bridgeExternalAccount.id,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.transaction_status,
            contractAddress: record.contract_address,
        }

    }

    return result
}

module.exports = fetchBridgeCryptoToFiatTransferRecord