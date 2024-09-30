const { bridgingUsdcScheduleCheck } = require("../../../../asyncJobs/bridging/cctp/bridgeUsdc")
const createJob = require("../../../../asyncJobs/createJob")
const { getBastionWallet } = require("../../bastion/utils/getBastionWallet")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const fetchBridgingTransactions = require("./fetchBridgingTransactions")

const createUsdcBridgingRequest = async (config) => {
    const { sourceUserId, destinationUserId, profileId, amount, sourceChain, destinationChain, sourceWalletType, destinationWalletType, requestId } = config
    try{
        const {walletAddress: sourceWalletAddress} = await getBastionWallet(sourceUserId, sourceChain)
        const {walletAddress: destinationWalletAddress} = await getBastionWallet(destinationUserId, destinationChain)
        // insert bridging record
        const { data, error } = await supabase
            .from('bridging_transactions')
            .update({
                source_user_id: sourceUserId,
                destination_user_id: destinationUserId,
                amount: amount,
                source_chain: sourceChain,
                destination_chain: destinationChain,
                source_wallet_address: sourceWalletAddress,
                destination_wallet_address: destinationWalletAddress,
                source_wallet_type: sourceWalletType,
                destination_wallet_type: destinationWalletType,
                current_stage: "INITIATE_BRIDGE",
                status: "CREATED",
                stage_status: "CREATED",
                wallet_provider: "BASTION",
                bridge_provider: "CIRCLE",
                stage_records: {},
                currency: "usdc"
            })
            .eq("request_id", requestId)
            .select()
            .single()
        if (error) throw error

        // create Job to initiate bridge
        const jobConfig = { bridgingRecordId: data.id }
        if (await bridgingUsdcScheduleCheck("bridgeUsdc", jobConfig, sourceUserId, profileId)){
            await createJob("bridgeUsdc", jobConfig, sourceUserId, profileId)
        }

        const receipt = await fetchBridgingTransactions(data.id, profileId)
        return receipt

    } catch (error) {
        await createLog("smartContract/cctp/createUsdcBridgingRequest", sourceUserId, error.message, error, profileId)
        throw error
    }
}

module.exports = { createUsdcBridgingRequest }
