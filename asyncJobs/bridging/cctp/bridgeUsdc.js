const supabase = require("../../../src/util/supabaseClient")
const { updateBridgingTransactionRecord, getBridgingTransactionRecord } = require("../../../src/util/transfer/bridging/bridgingTransactionTableService")
const { gasCheck } = require("../../../src/util/transfer/walletOperations/gas/gasCheck")
const notifyBridgingUpdate = require("../../../webhooks/bridging/notifyBridgingUpdate")
const createJob = require("../../createJob")
const { JobError, JobErrorType } = require("../../error")
const areObjectsEqual = require("../../utils/configCompare")
const { approveUsdc } = require("./approveUsdc")
const { depositUsdcForBurn } = require("./burnUsdc")
const { mintUsdc } = require("./mintUsdc")

const bridgingUsdcScheduleCheck = async(job, config, userId, profileId) => {

    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)
        .order("created_at", {ascending: false})
    
    if (!data || data.length <= 0) return true
    for (const record of data){
        if (areObjectsEqual(record.config, config)) return false
    }

    return true
}

const checkIsContractActionConfirmedAndUpdateStatus = async(recordId, bridgingRecordId) => {
    const { data, error } = await supabase
        .from('contract_actions')
        .select()
        .eq('id', recordId)
        .single()
    if (error) throw error

    // update bridging record status
    if (!data.status) await updateBridgingTransactionRecord(bridgingRecordId, { stage_status: "FAILED", status: "FAILED", failed_reason: "Please contact HIFI for more information" })
    else if (data.status === "FAILED") await updateBridgingTransactionRecord(bridgingRecordId, { stage_status: "FAILED", status: "FAILED", failed_reason: "Please contact HIFI for more information" })
    else if (data.status === "CONFIRMED") await updateBridgingTransactionRecord(bridgingRecordId, { stage_status: "COMPLETED" })

    return data.status
}


const bridgeUsdc = async (config) => {
    const { bridgingRecordId, userId, profileId } = config

    // get bridging record
    const bridgingRecord = await getBridgingTransactionRecord(bridgingRecordId)

    // update bridging record status to in progress
    await updateBridgingTransactionRecord(bridgingRecordId, { status: "PROCESSING" })

    try{
        // approve usdc
        if (bridgingRecord.current_stage === "INITIATE_BRIDGE") {
            // check gas
            const { needFund, fundSubmitted } = await gasCheck(bridgingRecord.source_user_id, bridgingRecord.source_chain, bridgingRecord.source_wallet_type, profileId)
            if (needFund) {
                // reschedule job, wait for gas to be enough
                const nextRetryTime = new Date(new Date().getTime() + 30000).toISOString() // check status after 30 seconds
                await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.source_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
                return
            }

            const { success, shouldReschedule } = await approveUsdc(bridgingRecord.source_user_id, profileId, bridgingRecord)
            if (!success) throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to approve usdc", null, null, shouldReschedule, true)
            // create job to burn usdc
            const nextRetryTime = new Date(new Date().getTime() + 30000).toISOString() // check status after 30 seconds
            await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.source_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
            return
        }
        // check if approve usdc is confirmed, then burn usdc
        else if (bridgingRecord.current_stage === "APPROVE_TO_TOKEN_MESSENGER") {
            // check previous contract action status
            const contractActionId = bridgingRecord.stage_records.APPROVE_TO_TOKEN_MESSENGER
            const contractActionStatus = await checkIsContractActionConfirmedAndUpdateStatus(contractActionId, bridgingRecordId)
            if (!contractActionStatus) throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to approve usdc, unknown contract action status", null, null, false, true)
            else if (contractActionStatus === "FAILED") throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to approve usdc, contract action failed", null, null, false, true)
            else if (contractActionStatus !== "CONFIRMED") {
                const nextRetryTime = new Date(new Date().getTime() + 10000).toISOString() // check status after 10 seconds
                await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.source_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
                return
            }
            // check gas
            const { needFund, fundSubmitted } = await gasCheck(bridgingRecord.source_user_id, bridgingRecord.source_chain, bridgingRecord.source_wallet_type, profileId)
            if (needFund) {
                // reschedule job, wait for gas to be enough
                const nextRetryTime = new Date(new Date().getTime() + 60000).toISOString() // check status after 60 seconds
                await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.source_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
                return
            }
            // burn usdc
            const { success, shouldReschedule } = await depositUsdcForBurn(bridgingRecord.source_user_id, profileId, bridgingRecord)
            if (!success) throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to burn usdc", null, null, shouldReschedule, true)
            // create job to mint usdc
            const nextRetryTime = new Date(new Date().getTime() + 30000).toISOString() // check status after 30 seconds
            await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.source_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
            return
        }
        // check if burn usdc is confirmed, then mint usdc
        else if (bridgingRecord.current_stage === "BURN_USDC_ON_SOURCE_CHAIN") {
            // check previous contract action status
            const contractActionId = bridgingRecord.stage_records.BURN_USDC_ON_SOURCE_CHAIN
            const contractActionStatus = await checkIsContractActionConfirmedAndUpdateStatus(contractActionId, bridgingRecordId)
            if (!contractActionStatus) throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to burn usdc, unknown contract action status", null, null, false, true)
            else if (contractActionStatus === "FAILED") throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to burn usdc, contract action failed", null, null, false, true)
            else if (contractActionStatus !== "CONFIRMED") {
                const nextRetryTime = new Date(new Date().getTime() + 10000).toISOString() // check status after 10 seconds
                await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.destination_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
                return
            }
            // check gas
            const { needFund, fundSubmitted } = await gasCheck(bridgingRecord.destination_user_id, bridgingRecord.destination_chain, bridgingRecord.destination_wallet_type, profileId)
            if (needFund) {
                // reschedule job, wait for gas to be enough
                const nextRetryTime = new Date(new Date().getTime() + 30000).toISOString() // check status after 30 seconds
                await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.destination_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
                return
            }
            // fetch attestation and mint usdc
            const { success, shouldReschedule, message, isAttestationConfirmed } = await mintUsdc(bridgingRecord.destination_user_id, profileId, bridgingRecord)
            if (!success) throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to mint usdc", null, null, shouldReschedule, true)

            // create job to either fetch attestation or confirm final status
            const nextRetryTime = new Date(new Date().getTime() + 10000).toISOString() // check status after 10 seconds
            await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.destination_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
            return
        }
        // check if attestation is confirmed, then mint usdc
        else if (bridgingRecord.current_stage === "FETCH_ATTESTATION") {
            // mint usdc
            const { success, shouldReschedule, message, isAttestationConfirmed } = await mintUsdc(bridgingRecord.destination_user_id, profileId, bridgingRecord)
            if (!success) throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to mint usdc", null, null, shouldReschedule, true)
            // create job to either fetch attestation or confirm final status
            const nextRetryTime = new Date(new Date().getTime() + 60000).toISOString() // check status after 60 seconds
            await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.destination_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
            return
        }
        // check if mint usdc is confirmed, then update bridging record status to success
        else if (bridgingRecord.current_stage === "RECEIVE_MESSAGE_AND_MINT") {
            const contractActionId = bridgingRecord.stage_records.RECEIVE_MESSAGE_AND_MINT
            const contractActionStatus = await checkIsContractActionConfirmedAndUpdateStatus(contractActionId, bridgingRecordId)
            if (!contractActionStatus) throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to mint usdc, unknown contract action status", null, null, false, true)
            if (contractActionStatus === "FAILED") throw new JobError(JobErrorType.INTERNAL_ERROR, "Failed to mint usdc, contract action failed", null, null, false, true)
            if (contractActionStatus !== "CONFIRMED") {
                const nextRetryTime = new Date(new Date().getTime() + 10000).toISOString() // check status after 10 seconds
                await createJob("bridgeUsdc", { bridgingRecordId }, bridgingRecord.destination_user_id, profileId, new Date().toISOString(), 0, nextRetryTime)
                return
            }
            
            // update bridging record status to success
            const updatedBridgingRecord = await updateBridgingTransactionRecord(bridgingRecordId, { status: "COMPLETED", updated_at: new Date().toISOString() })

            // send notification
            await notifyBridgingUpdate(updatedBridgingRecord)
            return
        }else{
            // unknown stage
            // update bridging record status to failed
            const updatedBridgingRecord = await updateBridgingTransactionRecord(bridgingRecordId, { status: "FAILED", updated_at: new Date().toISOString() })
            throw new JobError(JobErrorType.INTERNAL_ERROR, "Unknown bridging stage: " + bridgingRecord.current_stage, null, null, false, true)
        }
    } catch (error) {
        await notifyBridgingUpdate(bridgingRecord)
        throw error
    }

}

module.exports = { 
    bridgeUsdc,
    bridgingUsdcScheduleCheck
 }