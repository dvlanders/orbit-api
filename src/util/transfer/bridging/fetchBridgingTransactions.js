const { getBridgeTransactionRecord } = require("../../bridge/bridgeTransactionTableService")
const supabase = require("../../supabaseClient")
const { transferType } = require("../utils/transfer")


const fetchBridgingTransactions = async (recordId, profileId) => {
    const { data, error } = await supabase
        .from('bridging_transactions')
        .select('*, feeRecord:developer_fee_record_id(*), bridgeTransactionRecord:bridge_transaction_record_id(*)')
        .eq('id', recordId)
        .single()

    if (error) {
        throw error
    }
    const response = data.bridgeTransactionRecord.bridge_response
    const receipt = response.receipt
    const sourceDepositInstruction = response.source_deposit_instructions


    const result = {
        transferType: transferType.BRIDGE_ASSET,
        transferDetails: {
            id: data.id,
            requestId: data.request_id,
            sourceUserId: data.source_user_id,
            destinationUserId: data.destination_user_id,
            sourceChain: data.source_chain,
            destinationChain: data.destination_chain,
            sourceWalletAddress: data.source_wallet_address,
            destinationWalletAddress: data.destination_wallet_address,
            amount: data.amount,
            amountIncludeDeveloperFee: response.amount_include_developer_fee,
            currency: data.currency,
            status: data.status,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            failedReason: data.failed_reason,
            fee: data.feeRecord ? {
                feeId: data.feeRecord.id,
                feeType: data.feeRecord.fee_type,
                feeAmount: data.feeRecord.fee_amount,
                feePercent: data.feeRecord.fee_percent,
                status: data.feeRecord.charged_status,
                transactionHash: data.feeRecord.transaction_hash,
                failedReason: data.feeRecord.failed_reason
            } : null,
            quoteInformation: receipt && sourceDepositInstruction ? {
                validFrom: null,
                validUntil: null,
                sendingCurrency: sourceDepositInstruction.currency,
                sendingAmount: sourceDepositInstruction.amount,
                receivingCurrency: data.destination_currency,
                receivingAmount: receipt.final_amount ? receipt.final_amount : null,
                exchangeFee: receipt.exchange_fee,
            } : null
        }
    }
    
    return result
}

module.exports = fetchBridgingTransactions
