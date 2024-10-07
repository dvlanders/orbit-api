const supabase = require("../../supabaseClient")
const { transferType } = require("../utils/transfer")


const fetchBridgingTransactions = async (recordId, profileId) => {
    const { data, error } = await supabase
        .from('bridging_transactions')
        .select('*')
        .eq('id', recordId)
        .single()

    if (error) {
        throw error
    }

    const transactionHash = {}
    const stages = data.stage_records
    await Promise.all(Object.keys(stages).map(async(stage) => {
        const recordId = stages[stage]
        const { data, error } = await supabase
            .from('contract_actions')
            .select()
            .eq('id', recordId) 
            .single()
        if (error) throw error

        transactionHash[stage] = data.transaction_hash
    }))


    const result = {
        transferType: transferType.BRIDGE_ASSET,
        transferDetails: {
            id: data.id,
            sourceUserId: data.source_user_id,
            destinationUserId: data.destination_user_id,
            sourceChain: data.source_chain,
            destinationChain: data.destination_chain,
            sourceWalletAddress: data.source_wallet_address,
            destinationWalletAddress: data.destination_wallet_address,
            amount: data.amount,
            currency: data.currency,
            status: data.status,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            transactionHash: transactionHash,
            failedReason: data.failed_reason
        }
    }
    
    return result
}

module.exports = fetchBridgingTransactions
