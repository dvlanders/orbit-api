const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

exports.insertContractActionRecord = async(requestInfo) => {
    const { data, error } = await supabaseCall(() => supabase
    .from('contract_actions')
    .insert(
        { 
            request_id: requestInfo.requestId, 
            user_id: requestInfo.userId,
            wallet_address: requestInfo.walletAddress,
            contract_address: requestInfo.contractAddress,
            wallet_provider: requestInfo.provider,
            chain: requestInfo.chain,
            action_input: requestInfo.actionInput,
            status: "CREATED",
            tag: requestInfo.tag
        },
    )
    .select("*")
    .single())

    if (error) throw error
    return data
        
}