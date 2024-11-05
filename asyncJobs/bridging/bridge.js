
const createLog = require("../../src/util/logger/supabaseLogger")
const { approveMaxTokenToPaymentProcessor } = require("../../src/util/smartContract/approve/approveToken")
const { getTokenAllowance } = require("../../src/util/smartContract/approve/getApproveAmount")
const { bridgeFunctionMap } = require("../../src/util/transfer/bridging/bridgeFunctions")
const { getBridgingTransactionRecord } = require("../../src/util/transfer/bridging/bridgingTransactionTableService")
const { toUnitsString } = require("../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { getDeveloperFeeRecord } = require("../../src/util/transfer/fee/developerFeeTableService")
const { gasCheck } = require("../../src/util/transfer/walletOperations/gas/gasCheck")
const { getRetryConfig } = require("../retryJob")

const bridgeAsset = async (jobConfig) => {
    try{
        const { recordId, profileId } = jobConfig
        const record = await getBridgingTransactionRecord(recordId)
        // gas check
        const { needFund, fundSubmitted } = await gasCheck(record.source_user_id, record.source_chain, record.source_wallet_type, profileId)
        if (needFund){
            return {
                retryDetails: getRetryConfig(true, 60000, "wallet gas not enough")
            }
        }

        // check allowance if not enough perform a token approve job and reschedule transfer
        if (record.developer_fee_record_id){
            const unitsAmount = toUnitsString(record.amount, currencyDecimal[record.source_currency]) 
            const paymentProcessorContractAddress = record.payment_processor_contract_address
            const allowance = await getTokenAllowance(record.source_chain, record.source_currency, record.source_address, paymentProcessorContractAddress)
            if (allowance < BigInt(unitsAmount)){
                await approveMaxTokenToPaymentProcessor(record.source_user_id, record.source_chain, record.source_currency, record.source_wallet_type)
                return {
                    retryDetails: getRetryConfig(true, 60000, "Token approve amount not enough")
                }
            }
        }

        const {executeBridging} = bridgeFunctionMap.universal
        await executeBridging({recordId, profileId})
    }catch(error){
        console.log(error)
        await createLog("asyncJobs/bridging/bridgeAsset", null, error.message, error)
        throw error
    }
}

module.exports = {
    bridgeAsset
}