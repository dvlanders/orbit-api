const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { burnUsdc } = require("../../../src/util/smartContract/cctp/burn")
const supabase = require("../../../src/util/supabaseClient")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { getUserWallet } = require("../../../src/util/user/getUserWallet")

const usdcDecimals = 6

const depositUsdcForBurn = async (userId, profileId, bridgingRecord) => {

    try {
        const sourceUserId = bridgingRecord.source_user_id
        const destinationUserId = bridgingRecord.destination_user_id
        const sourceChain = bridgingRecord.source_chain
        const destinationChain = bridgingRecord.destination_chain
        const sourceWalletType = bridgingRecord.source_wallet_type
        const destinationWalletType = bridgingRecord.destination_wallet_type
        const bridgingRecordId = bridgingRecord.id
        const amount = bridgingRecord.amount
        const unitAmount = toUnitsString(amount, usdcDecimals)


        // update bridging record status to in progress
        const { data, error } = await supabase
            .from('bridging_transactions')
            .update({ 
                stage_status: "PROCESSING", 
                current_stage: "BURN_USDC_ON_SOURCE_CHAIN",
                updated_at: new Date().toISOString()
            })
            .eq('id', bridgingRecordId)
            .select()
            .single()
        
        const stageRecords = data.stage_records
            
        const { success, record, errorMessageForCustomer } = await burnUsdc(unitAmount, sourceChain, destinationChain, sourceUserId, destinationUserId, sourceWalletType, destinationWalletType)

        // update stage record
        stageRecords.BURN_USDC_ON_SOURCE_CHAIN = record.id

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
        await createLog("asyncJobs/bridging/cctp/burnUsdc.js", userId, error.message, error, profileId)
        return {success: false, shouldReschedule: false}
    }

}

module.exports = { depositUsdcForBurn }