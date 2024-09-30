const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { approveToTokenMessenger } = require("../../../src/util/smartContract/cctp/approve")
const supabase = require("../../../src/util/supabaseClient")

const approveUsdc = async (config) => {
    const userId = config.userId
    const chain = config.chain
    const walletType = config.walletType
    const profileId = config.profileId
    const bridgingRecordId = config.bridgingRecordId

    try {
        // update bridging record status to in progress
        const { data, error } = await supabase
            .from('bridging_transactions')
            .update({ 
                stage_status: "PROCESSING", 
                current_stage: "APPROVE_TO_TOKEN_MESSENGER",
                updated_at: new Date().toISOString()
            })
            .eq('id', bridgingRecordId)
            .select()
            .single()
        
        const stageRecords = data.stage_records
            
        const { walletAddress, bastionUserId } = await getBastionWallet(userId, chain, walletType)
        const { success, record } = await approveToTokenMessenger(amount, chain, userId, bastionUserId, walletAddress)

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
                    stage_records: stageRecords
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
                stage_status: "COMPLETE",
                status: "PROCESSING",
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