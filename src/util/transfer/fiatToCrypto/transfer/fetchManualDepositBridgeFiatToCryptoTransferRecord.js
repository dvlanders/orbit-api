const { virtualAccountPaymentRailToChain } = require("../../../bridge/utils")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { transferType } = require("../../utils/transfer")
const { fetchFiatToCryptoRequestInfortmaionById } = require("../utils/fetchRequestInformation")
const { convertKeysToCamelCase } = require("../../../utils/object")

const fetchManualDepositBridgeFiatToCryptoTransferRecord = async(id, profileId) => {
    // get transactio record
    const record = await fetchFiatToCryptoRequestInfortmaionById(id, profileId)
    if (!record) return null
    // get rail information
    let { data: bridgeVirtualAccount, error: bridgeVirtualAccountError } = await supabaseCall(() => supabase
        .from('bridge_virtual_accounts')
        .select('*')
        .eq("id", record.bridge_transfer_info?.virtual_account_id)
        .single())

    if (bridgeVirtualAccountError) throw bridgeVirtualAccountError
        
    const result = {
        transferType: transferType.FIAT_TO_CRYPTO,
        transferDetails: {
            id: record.id,
            requestId: record.request_id,
            sourceUserId: record.user_id,
            destinationUserId: record.destination_user_id,
            transactionHash: record.transaction_hash,
            chain: virtualAccountPaymentRailToChain[bridgeVirtualAccount.destination_payment_rail],
            sourceCurrency: bridgeVirtualAccount.source_currency,
            amount: record.amount,
            destinationCurrency: bridgeVirtualAccount.destination_currency,
            sourceAccountId: null,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.status,
            sourceUser: convertKeysToCamelCase(record.source_user.user_kyc),
            destinationUser: convertKeysToCamelCase(record.destination_user.user_kyc),
            sourceAccount: convertKeysToCamelCase(record.source_manual_deposit),
            fee: record.developer_fees ? {
                feeId: record.developer_fees.id,
                feeType: record.developer_fees.fee_type,
                feeAmount: record.developer_fees.fee_amount,
                feePercent: record.developer_fees.fee_percent,
                status: record.developer_fees.charged_status,
                transactionHash: record.developer_fees.transaction_hash,
                failedReason: record.developer_fees.failed_reason
            } : null,
            virtualAccountInformation:{
                virtualAccountId: bridgeVirtualAccount.id,
                userId: bridgeVirtualAccount.user_id,
                paymentRails: bridgeVirtualAccount.source_payment_rails,
                sourceCurrency: bridgeVirtualAccount.source_currency,
                destinationChain: virtualAccountPaymentRailToChain[bridgeVirtualAccount.destination_payment_rail],
                destinationCurrency: bridgeVirtualAccount.destination_currency,
                destinationWalletAddress: bridgeVirtualAccount.destination_wallet_address,
                railStatus: bridgeVirtualAccount.status,
                depositInstructions: {
                    bankName: bridgeVirtualAccount.deposit_institutions_bank_name,
                    routingNumber: bridgeVirtualAccount.deposit_institutions_bank_routing_number,
                    accountNumber: bridgeVirtualAccount.deposit_institutions_bank_account_number,
                    bankAddress: bridgeVirtualAccount.deposit_institutions_bank_address
                }
            }
        }
    }

    return result
}

module.exports = fetchManualDepositBridgeFiatToCryptoTransferRecord