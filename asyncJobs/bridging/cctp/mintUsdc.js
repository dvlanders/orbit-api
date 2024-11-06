const { getMappedError } = require("../../../src/util/bastion/utils/errorMappings")
const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { burnUsdc } = require("../../../src/util/smartContract/cctp/burn")
const { fetchAttestation } = require("../../../src/util/smartContract/cctp/fetchAttestation")
const { receiveMessageAndMint } = require("../../../src/util/smartContract/cctp/receiveMessageAndMint")
const supabase = require("../../../src/util/supabaseClient")
const { updateBridgingTransactionRecord } = require("../../../src/util/transfer/bridging/bridgingTransactionTableService")
const { getContractActionRecord } = require("../../../src/util/transfer/contractAction/contractActionTableService")
const { gasCheck } = require("../../../src/util/transfer/gas/main/gasCheck")

const mintUsdc = async (userId, profileId, bridgingRecord) => {

    try {
        const bridgingRecordId = bridgingRecord.id
        const destinationUserId = bridgingRecord.destination_user_id
        const sourceChain = bridgingRecord.source_chain
        const destinationChain = bridgingRecord.destination_chain
        const destinationWalletType = bridgingRecord.destination_wallet_type
        const burnUsdcRecordId = bridgingRecord.stage_records.BURN_USDC_ON_SOURCE_CHAIN

        let toUpdate = {
            stage_status: "PROCESSING", 
            current_stage: "FETCH_ATTESTATION",
            updated_at: new Date().toISOString()
        }
        const data = await updateBridgingTransactionRecord(bridgingRecordId, toUpdate)

        const burnUsdcRecord = await getContractActionRecord(burnUsdcRecordId)
        if (!burnUsdcRecord) throw new Error(`No burn usdc record found for id: ${burnUsdcRecordId}`)
        const transactionHash = burnUsdcRecord.transaction_hash

        // fetch attestation
        const { confirmed, attestationSignature, messageBytes } = await fetchAttestation(sourceChain, transactionHash)
        if (!confirmed) return {success: true, shouldReschedule: true, message: "Attestation not yet confirmed", isAttestationConfirmed: false}

        // check if gas is enough
        const { needFund, fundSubmitted } = await gasCheck(bridgingRecord.destination_user_id, bridgingRecord.destination_chain, bridgingRecord.destination_wallet_type, profileId)
        if (needFund) return{success: true, shouldReschedule: true, message: "Gas not enough", isAttestationConfirmed: true}

        // attestation is confirmed, update bridging record status to in progress
        toUpdate = {
            stage_status: "PROCESSING", 
            current_stage: "RECEIVE_MESSAGE_AND_MINT",
            updated_at: new Date().toISOString()
        }
        const updatedBridgingRecord_BURN_USDC_ON_SOURCE_CHAIN = await updateBridgingTransactionRecord(bridgingRecordId, toUpdate)
        const stageRecords = updatedBridgingRecord_BURN_USDC_ON_SOURCE_CHAIN.stage_records

        // receive message and mint usdc on destination chain
        const { success, record, errorMessageForCustomer } = await receiveMessageAndMint(destinationUserId, destinationChain, destinationWalletType, messageBytes, attestationSignature)

        // update stage record
        stageRecords.RECEIVE_MESSAGE_AND_MINT = record.id

        if (!success) {
            const toUpdate = {
                stage_status: "FAILED",
                status: "FAILED",
                updated_at: new Date().toISOString(),
                stage_records: stageRecords,
                failed_reason: errorMessageForCustomer
            }
            await updateBridgingTransactionRecord(bridgingRecordId, toUpdate)
            return {success: false, shouldReschedule: false, isAttestationConfirmed: true}
        }

        toUpdate = {
            updated_at: new Date().toISOString(),
            stage_records: stageRecords
        }
        await updateBridgingTransactionRecord(bridgingRecordId, toUpdate)
        return {success: true, shouldReschedule: false, isAttestationConfirmed: true}

    } catch (error) {
        await createLog("asyncJobs/bridging/cctp/mintUsdc.js", userId, error.message, error, profileId)
        return {success: false, shouldReschedule: false}
    }

}

module.exports = { mintUsdc }