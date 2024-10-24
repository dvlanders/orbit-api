const { checkBalanceForTransactionAmount } = require("../../../src/util/bastion/utils/balanceCheck")
const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { burnUsdc } = require("../../../src/util/smartContract/cctp/burn")
const supabase = require("../../../src/util/supabaseClient")
const { updateBridgingTransactionRecord } = require("../../../src/util/transfer/bridging/bridgingTransactionTableService")
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

        let toUpdate = {
            stage_status: "PROCESSING", 
            current_stage: "BURN_USDC_ON_SOURCE_CHAIN",
            updated_at: new Date().toISOString()
        }

        // check if user has enough balance
        if(!(await checkBalanceForTransactionAmount(sourceUserId, amount, sourceChain, "usdc"))){
            const toUpdate = {
                stage_status: "FAILED",
                status: "FAILED",
                updated_at: new Date().toISOString(),
                failed_reason: "Insufficient balance"
            }
            await updateBridgingTransactionRecord(bridgingRecordId, toUpdate)
            return {success: false, shouldReschedule: false}
        }


        const data = await updateBridgingTransactionRecord(bridgingRecordId, toUpdate)        
        const stageRecords = data.stage_records
            
        const { success, record, errorMessageForCustomer } = await burnUsdc(unitAmount, sourceChain, destinationChain, sourceUserId, destinationUserId, sourceWalletType, destinationWalletType)

        // update stage record
        stageRecords.BURN_USDC_ON_SOURCE_CHAIN = record.id

        if (!success) {
            const toUpdate = {
                stage_status: "FAILED",
                status: "FAILED",
                updated_at: new Date().toISOString(),
                stage_records: stageRecords,
                failed_reason: errorMessageForCustomer
            }
            await updateBridgingTransactionRecord(bridgingRecordId, toUpdate)
            return {success: false, shouldReschedule: false}
        }

        toUpdate = {
            updated_at: new Date().toISOString(),
            stage_records: stageRecords
        }
        await updateBridgingTransactionRecord(bridgingRecordId, toUpdate)
        return {success: true, shouldReschedule: false}

    } catch (error) {
        await createLog("asyncJobs/bridging/cctp/burnUsdc.js", userId, error.message, error, profileId)
        return {success: false, shouldReschedule: false}
    }

}

module.exports = { depositUsdcForBurn }