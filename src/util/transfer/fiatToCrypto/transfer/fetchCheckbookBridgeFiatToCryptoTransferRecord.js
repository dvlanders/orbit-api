const { virtualAccountPaymentRailToChain } = require("../../../bridge/utils")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { transferType } = require("../../utils/transfer")
const { fetchFiatToCryptoRequestInfortmaionById } = require("../utils/fetchRequestInformation")

const fetchCheckbookBridgeFiatToCryptoTransferRecord = async(id, profileId) => {
    // get transactio record
    const record = await fetchFiatToCryptoRequestInfortmaionById(id, profileId)
    if (!record) return null
    // get rail information
    let { data: bridgeVirtualAccount, error: bridgeVirtualAccountError } = await supabaseCall(() => supabase
        .from('bridge_virtual_accounts')
        .select('destination_payment_rail, source_currency, destination_currency')
        .eq("virtual_account_id", record.bridge_virtual_account_id)
        .single())

    if (bridgeVirtualAccountError) throw bridgeVirtualAccountError

    // get source plaid account information

    let { data: plaidAccount, error: plaidAccountError } = await supabaseCall(() => supabase
        .from('checkbook_accounts')
        .select('id, account_number, routing_number, bank_name')
        .eq("checkbook_id", record.plaid_checkbook_id)
        .single())

    if (plaidAccountError) throw plaidAccountError
        
    const result = {
        transferType: transferType.FIAT_TO_CRYPTO,
        transferDetails: {
            id: record.id,
            requestId: record.request_id,
            sourceUserId: record.user_id,
            destinationUserId: record.destination_user_id,
            transactionHash: record.transaction_hash,
            chain: virtualAccountPaymentRailToChain[bridgeVirtualAccount.destination_payment_rail],
            sourceCurrency: record.source_currency,
            amount: record.amount,
            destinationCurrency: record.destination_currency,
            sourceAccountId: plaidAccount.id,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.status,
            sourceUser: record.source_user.user_kyc,
            destinationUser: record.destination_user.user_kyc,
            sourceAccount: plaidAccount,
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

module.exports = fetchCheckbookBridgeFiatToCryptoTransferRecord