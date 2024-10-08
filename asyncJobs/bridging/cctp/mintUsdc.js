const { getMappedError } = require("../../../src/util/bastion/utils/errorMappings")
const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { approveToTokenMessenger } = require("../../../src/util/smartContract/cctp/approve")
const { burnUsdc } = require("../../../src/util/smartContract/cctp/burn")
const { fetchAttestation } = require("../../../src/util/smartContract/cctp/fetchAttestation")
const { receiveMessageAndMint } = require("../../../src/util/smartContract/cctp/receiveMessageAndMint")
const supabase = require("../../../src/util/supabaseClient")

const mintUsdc = async (userId, profileId, bridgingRecord) => {

    try {
        const bridgingRecordId = bridgingRecord.id
        const destinationUserId = bridgingRecord.destination_user_id
        const sourceChain = bridgingRecord.source_chain
        const destinationChain = bridgingRecord.destination_chain
        const destinationWalletType = bridgingRecord.destination_wallet_type
        const burnUsdcRecordId = bridgingRecord.stage_records.BURN_USDC_ON_SOURCE_CHAIN
        
        // update bridging record status to in progress
        const { data: updatedBridgingRecord, error: updatedBridgingRecordError } = await supabase
            .from('bridging_transactions')
            .update({ 
                stage_status: "PROCESSING", 
                current_stage: "FETCH_ATTESTATION",
                updated_at: new Date().toISOString()
            })
            .eq('id', bridgingRecordId)
            .select()
            .single()
        if (updatedBridgingRecordError) throw updatedBridgingRecordError

        // fetch burn usdc record
        const { data: burnUsdcRecord, error: burnUsdcRecordError } = await supabase
            .from('contract_actions')
            .select()
            .eq('id', burnUsdcRecordId)
            .single()
        if (burnUsdcRecordError) throw burnUsdcRecordError
        const transactionHash = burnUsdcRecord.transaction_hash

        // fetch attestation
        const { confirmed, attestationSignature, messageBytes } = await fetchAttestation(sourceChain, transactionHash)
        if (!confirmed) return {success: true, shouldReschedule: true, message: "Attestation not yet confirmed", isAttestationConfirmed: false}
        
        // attestation is confirmed, update bridging record status to in progress
        const { data: updatedBridgingRecord_BURN_USDC_ON_SOURCE_CHAIN, error: updatedBridgingRecordError_BURN_USDC_ON_SOURCE_CHAIN } = await supabase
            .from('bridging_transactions')
            .update({ 
                stage_status: "PROCESSING", 
                current_stage: "RECEIVE_MESSAGE_AND_MINT",
                updated_at: new Date().toISOString()
            })
            .eq('id', bridgingRecordId)
            .select()
            .single()
        
        if (updatedBridgingRecordError_BURN_USDC_ON_SOURCE_CHAIN) throw updatedBridgingRecordError_BURN_USDC_ON_SOURCE_CHAIN
        
        const stageRecords = updatedBridgingRecord_BURN_USDC_ON_SOURCE_CHAIN.stage_records
        const { walletAddress: destinationWalletAddress, bastionUserId: destinationBastionUserId } = await getBastionWallet(destinationUserId, destinationChain, destinationWalletType)

        // receive message and mint usdc on destination chain
        const { success, record, errorMessageForCustomer } = await receiveMessageAndMint(destinationUserId, destinationBastionUserId, destinationChain, messageBytes, attestationSignature, destinationWalletAddress)

        // update stage record
        stageRecords.RECEIVE_MESSAGE_AND_MINT = record.id

        if (!success) {
            // update bridging record status to failed
            const { data: updatedRecord, error: updatedError } = await supabase
                .from('bridging_transactions')
                .update({ 
                    stage_status: "FAILED",
                    status: "FAILED",
                    updated_at: new Date().toISOString(),
                    stage_records: stageRecords,
                    failed_reason: errorMessageForCustomer
                })
                .eq('id', bridgingRecordId)
                .select()
                .single()

            if (updatedError)  throw updatedError
            return {success: false, shouldReschedule: false, isAttestationConfirmed: true}
        }

        const { data: updatedRecord, error: updatedError } = await supabase
            .from('bridging_transactions')
            .update({ 
                updated_at: new Date().toISOString(),
                stage_records: stageRecords
            })
            .eq('id', bridgingRecordId)
            .select()
            .single()

        if (updatedError)  throw updatedError
        return {success: true, shouldReschedule: false, isAttestationConfirmed: true}

    } catch (error) {
        await createLog("asyncJobs/bridging/cctp/mintUsdc.js", userId, error.message, error, profileId)
        return {success: false, shouldReschedule: false}
    }

}

module.exports = { mintUsdc }