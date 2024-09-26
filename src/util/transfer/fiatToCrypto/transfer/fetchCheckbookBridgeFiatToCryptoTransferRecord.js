const { virtualAccountPaymentRailToChain } = require("../../../bridge/utils")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { transferType } = require("../../utils/transfer")
const { fetchFiatToCryptoRequestInfortmaionById } = require("../utils/fetchRequestInformation")
const { convertKeysToCamelCase } = require("../../../utils/object")

const fetchCheckbookBridgeFiatToCryptoTransferRecord = async(id, profileId) => {
    // get transactio record
    const record = await fetchFiatToCryptoRequestInfortmaionById(id, profileId)
    if (!record) return null
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
            chain: record.chain,
            sourceCurrency: record.source_currency,
            amount: record.amount,
            destinationCurrency: record.destination_currency,
            sourceAccountId: plaidAccount.id,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.status,
            sourceUser: convertKeysToCamelCase(record.source_user.user_kyc),
            destinationUser: convertKeysToCamelCase(record.destination_user.user_kyc),
            sourceAccount: convertKeysToCamelCase(plaidAccount),
            fee: record.developer_fees ? {
                feeId: record.developer_fees.id,
                feeType: record.developer_fees.fee_type,
                feeAmount: record.developer_fees.fee_amount,
                feePercent: record.developer_fees.fee_percent,
                status: record.developer_fees.charged_status,
                transactionHash: record.developer_fees.transaction_hash,
                failedReason: record.developer_fees.failed_reason
            } : null,
            failedReason: record.failed_reason,
        }
    }

    return result
}

module.exports = fetchCheckbookBridgeFiatToCryptoTransferRecord