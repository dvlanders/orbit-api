const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const { updateBridgeTransactionRecord } = require("../../../src/util/bridge/bridgeTransactionTableService")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { approveToTokenMessenger } = require("../../../src/util/smartContract/cctp/approve")
const supabase = require("../../../src/util/supabaseClient")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { getUserWallet } = require("../../../src/util/user/getUserWallet")

const usdcDecimals = 6

const approveUsdc = async (userId, profileId, bridgingRecord) => {
    try {
        const userId = bridgingRecord.source_user_id
        const chain = bridgingRecord.source_chain
        const walletType = bridgingRecord.source_wallet_type
        const amount = bridgingRecord.amount
        const unitAmount = toUnitsString(amount, usdcDecimals)
        const bridgingRecordId = bridgingRecord.id
        
        // update bridging record status to in progress
        const toUpdate = {
            stage_status: "PROCESSING", 
            current_stage: "APPROVE_TO_TOKEN_MESSENGER",
            updated_at: new Date().toISOString()
        }
        const data = await updateBridgeTransactionRecord(bridgingRecordId, toUpdate)
        
        const stageRecords = data.stage_records
            
        const { success, record, errorMessageForCustomer } = await approveToTokenMessenger(unitAmount, chain, userId, walletType)

        // update stage record
        stageRecords.APPROVE_TO_TOKEN_MESSENGER = record.id

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
            return {success: false, shouldReschedule: false}
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
        return {success: true, shouldReschedule: false}

    } catch (error) {
        await createLog("asyncJobs/bridging/cctp/approveUsdc.js", userId, error.message, error, profileId)
        return {success: false, shouldReschedule: false}
    }

}

module.exports = { approveUsdc }