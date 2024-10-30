const createJob = require("../../../../asyncJobs/createJob")
const { checkBalanceForTransactionAmount } = require("../../bastion/utils/balanceCheck")
const { getBastionWallet } = require("../../bastion/utils/getBastionWallet")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { getUserWallet } = require("../../user/getUserWallet")
const { insertSingleBridgingTransactionRecord, updateBridgingTransactionRecord } = require("./bridgingTransactionTableService")
const fetchBridgingTransactions = require("./fetchBridgingTransactions")

const createUsdcBridgingRequest = async (config) => {
    const { sourceUserId, destinationUserId, profileId, amount, sourceChain, destinationChain, sourceWalletType, destinationWalletType, requestId, newRecord } = config
    try{
        const {address: sourceWalletAddress, walletProvider: sourceWalletProvider} = await getUserWallet(sourceUserId, sourceChain, sourceWalletType)
        const {address: destinationWalletAddress, walletProvider: destinationWalletProvider} = await getUserWallet(destinationUserId, destinationChain, destinationWalletType)

        // insert bridging record
        const toUpdate = {
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
            source_wallet_provider: sourceWalletProvider,
            destination_wallet_provider: destinationWalletProvider,
            bridge_provider: "CIRCLE",
            stage_records: {},
            currency: "usdc"
        }

        // check if user has enough balance
        if(!(await checkBalanceForTransactionAmount(sourceUserId, amount, sourceChain, "usdc"))){
            toUpdate.status = "FAILED"
            toUpdate.failed_reason = "Insufficient balance"
            const record = await updateBridgingTransactionRecord(newRecord.id, toUpdate)
            const receipt = await fetchBridgingTransactions(record.id, profileId)
            return receipt
        }

        const record = await updateBridgingTransactionRecord(newRecord.id, toUpdate)
        
        // create Job to initiate bridge
        const jobConfig = { bridgingRecordId: record.id }
        await createJob("bridgeUsdc", jobConfig, sourceUserId, profileId)

        const receipt = await fetchBridgingTransactions(record.id, profileId)
        return receipt

    } catch (error) {
        await createLog("smartContract/cctp/createUsdcBridgingRequest", sourceUserId, error.message, error, profileId)
        throw error
    }
}

module.exports = { createUsdcBridgingRequest }
