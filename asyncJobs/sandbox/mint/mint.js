const { v4 } = require("uuid")
const { insertContractActionRecord } = require("../../../src/util/smartContract/insertContractActionRecord")
const { mintUSDHIFI } = require("../../../src/util/smartContract/sandboxUSDHIFI/mint")
const { updateContractActionRecord } = require("../../../src/util/smartContract/updateContractActionRecord")
const createJob = require("../../createJob")
const { mintCheckScheduleCheck } = require("./scheduleCheck")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { getUserActions } = require("../../../src/util/bastion/endpoints/getUserAction")
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../../../src/util/transfer/cryptoToBankAccount/utils/simulateSandboxCryptoToFiatTransaction")
const { simulateSandboxFiatToCryptoTransactionStatus } = require("../../../src/util/transfer/fiatToCrypto/utils/simulateSandboxFiatToCryptoTransaction")
const notifyFiatToCryptoTransfer = require("../../../webhooks/transfer/notifyFiatToCryptoTransfer")
const supabase = require("../../../src/util/supabaseClient")


const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'


const mintCheck = async(config) => {
    const onRampRecordId = config.onRampRecordId
    const userId = config.userId
    const contractActionRecordId = config.contractActionRecordId
    try{
        // check contract actions
        const {data, error} = await supabase
            .from("contract_actions")
            .select("*")
            .eq("id", contractActionRecordId)
            .maybeSingle()
        
        if (error) throw error
        if (!data) throw new Error("Contract action record not found")

        const response = await getUserActions(data.bastion_request_id, data.bastion_user_id)
        const responseBody = await response.json()

        const toUpdate = {
            bastion_response: responseBody
        }

        if (!response.ok){
            toUpdate.status =  "FAILED"
            toUpdate.failed_reason=  responseBody.message
            await createLog("asyncJob/mintCheck", userId, responseBody.message, responseBody, profileId)
        }else{
            toUpdate.status = responseBody.status
            toUpdate.bastion_status = responseBody.status
            toUpdate.transaction_hash = responseBody.transactionHash
        }

        await updateContractActionRecord(contractActionRecordId, toUpdate)

        if (!response.ok || !responseBody.status) return

        // reinsert check job if not yet in final status
        if (responseBody.status && (responseBody.status == "SUBMITTED" || responseBody.status == "ACCEPTED")){
            await createJob("mintCheck", config, userId, profileId)
            return
        }

        // update onramp record
        const {data: onrampRecord, error: onrampRecordError} = await supabase
            .from("onramp_transactions")
            .update({
                status: responseBody.status == "CONFIRMED" ? "CONFIRMED" : "FAILED",
                updated_at: new Date().toISOString(),
                transaction_hash: responseBody.transactionHash
            })
            .eq("id", onRampRecordId)
            .select("*")
            .maybeSingle()

        if (onrampRecordError) throw onrampRecordError
        if (!onrampRecord) throw new Error("Onramp record not found")
        await simulateSandboxFiatToCryptoTransactionStatus(onrampRecord)
        await notifyFiatToCryptoTransfer(onrampRecord)
    }catch (error){
        await createLog("asyncJob/mintCheck", userId, error.message, error, profileId)

        // update contract action record
        const toUpdate = {
            status: "FAILED",
            failed_reason: error.message
        }
        await updateContractActionRecord(contractActionRecordId, toUpdate)

        // update onramp record
        const {data: onrampRecord, error: onrampRecordError} = await supabase
            .from("onramp_transactions")
            .update({
                status: "FAILED",
                failed_reason: "Please contact HIFI for more information"
            })
            .eq("id", onRampRecordId)
            .select("*")
            .maybeSingle()
            
        await notifyFiatToCryptoTransfer(onrampRecord)
    }
}

const mint = async(config) => {
    const chain = config.chain
    const userId = config.userId
    const walletAddress = config.walletAddress
    const amount = config.amount
    const onRampRecordId = config.onRampRecordId
    const profileId = config.profileId
    try{
        // mint USDHIFI
        const requestId = v4()
        const contractAddress = USDHIFIContractAddressMap[chain];
        // insert initial record
        const requestInfo = {
            bastionRequestId: requestId,
            userId,
            chain,
            contractAddress: contractAddress,
            walletAddress,
            provider: "BASTION",
            actionInput: 
                [
                    { name: "to", value: walletAddress },
                    { name: "amount", value: unitsAmount }
                ]
            ,
            tag: "MINT_USDHIFI",
            bastionUserId: gasStation
        }

        const record = await insertContractActionRecord(requestInfo)

        // submit user action to bastion
        const response = await mintUSDHIFI(walletAddress, amount, chain)
        const responseBody = await response.json()

        const toUpdate = {
            bastion_response: responseBody,
            updated_at: new Date().toISOString()
        }

        if (!response.ok){
            toUpdate.status = "FAILED"
            toUpdate.bastion_status = "FAILED"
            toUpdate.failed_reason = responseBody.message
        }else{
            toUpdate.status = responseBody.status
            toUpdate.bastion_status = responseBody.status
            toUpdate.transaction_hash = responseBody.transactionHash
        }

        await updateContractActionRecord(record.id, toUpdate)

        // insert mint check if success
        if (responseBody.status && (responseBody.status == "SUBMITTED" || responseBody.status == "ACCEPTED")){
            const newJogConfig = {...config, contractActionRecordId: record.id}
            if (!(await mintCheckScheduleCheck("mintCheck", newJogConfig, userId, profileId))) return
            await createJob("mintCheck", newJogConfig, userId, profileId)
        }

    }catch (error){
        await createLog("asyncJob/mint", userId, error.message, error, profileId)
        const toUpdate = {
            status: "FAILED",
            failed_reason: error.message
        }
        await updateContractActionRecord(record.id, toUpdate)
    }
}

module.exports = {
    mintCheck,
    mint
}