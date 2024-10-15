const { v4 } = require("uuid")
const { mintUSDHIFI } = require("../../../src/util/smartContract/sandboxUSDHIFI/mint")
const createJob = require("../../createJob")
const { mintCheckScheduleCheck } = require("./scheduleCheck")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../../../src/util/transfer/cryptoToBankAccount/utils/simulateSandboxCryptoToFiatTransaction")
const { simulateSandboxFiatToCryptoTransactionStatus } = require("../../../src/util/transfer/fiatToCrypto/utils/simulateSandboxFiatToCryptoTransaction")
const notifyFiatToCryptoTransfer = require("../../../webhooks/transfer/notifyFiatToCryptoTransfer")
const supabase = require("../../../src/util/supabaseClient")
const { USDHIFIContractAddressMap } = require("../../../src/util/smartContract/sandboxUSDHIFI/utils")
const { getUserWallet } = require("../../../src/util/user/getUserWallet")
const { insertWalletTransactionRecord, submitWalletUserAction, getUserAction, updateWalletTransactionRecord } = require("../../../src/util/transfer/walletOperations/utils")
const { transferType } = require("../../../src/util/transfer/utils/transfer")
const { updateOnrampTransactionRecord } = require("../../../src/util/transfer/fiatToCrypto/utils/onrampTransactionTableService")
const { updateContractActionRecord, insertSingleContractActionRecord, getContractActionRecord } = require("../../../src/util/transfer/contractAction/contractActionTableService")
const { statusMapBastion } = require("../../../src/util/transfer/walletOperations/bastion/statusMap")


const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'


const mintCheck = async(config) => {
    const onRampRecordId = config.onRampRecordId
    const userId = config.userId
    const contractActionRecordId = config.contractActionRecordId
    const profileId = config.profileId
    try{
        // check contract actions
        const {data: contractActionRecord, error: contractActionRecordError} = await supabase
            .from("contract_actions")
            .select("*, bastionTransaction: bastion_transaction_record_id(request_id, bastion_user_id), bastion_transaction_record_id")
            .eq("id", contractActionRecordId)
            .maybeSingle()

        // reinsert check job if not yet in final status
        if ((contractActionRecord.status == "SUBMITTED" || contractActionRecord.status == "ACCEPTED" || contractActionRecord.status == "PENDING")){
            const currentTime = new Date();
            currentTime.setSeconds(currentTime.getSeconds() + 30);
            const nextRetry = currentTime.toISOString()
            await createJob("mintCheck", config, userId, profileId, currentTime.toISOString(), 0, nextRetry)
            return
        }

        const toUpdateOnrampRecord = {
            status: contractActionRecord.status == "CONFIRMED" ? "CONFIRMED" : "FAILED",
            updated_at: new Date().toISOString(),
        }

        // update onramp record
        const onRampRecord = await updateOnrampTransactionRecord(onRampRecordId, toUpdateOnrampRecord)
        await simulateSandboxFiatToCryptoTransactionStatus(onRampRecord)
        await notifyFiatToCryptoTransfer(onRampRecord)
    }catch (error){
        await createLog("asyncJob/mintCheck", userId, error.message, error, profileId)
        // update onramp record
        const toUpdateOnrampRecord = {
            status: "FAILED",
            failed_reason: "Please contact HIFI for more information",
            updated_at: new Date().toISOString()
        }
        const onRampRecord = await updateOnrampTransactionRecord(onRampRecordId, toUpdateOnrampRecord)
        await notifyFiatToCryptoTransfer(onRampRecord)
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
        // insert wallet provider record
        const toInsertWalletProviderRecord = {
            user_id: userId,
            request_id: v4(),
            bastion_user_id: gasStation
        }
        const walletProviderRecord = await insertWalletTransactionRecord("BASTION", toInsertWalletProviderRecord)

        // mint USDHIFI
        const contractAddress = USDHIFIContractAddressMap[chain];
        const unitsAmount = amount * Math.pow(10, 6)
        const actionInput = [
            { name: "to", value: walletAddress },
            { name: "amount", value: unitsAmount }
        ]

        // insert initial record
        const mintRequestInfo = { 
            user_id: userId,
            wallet_address: walletAddress,
            contract_address: contractAddress,
            wallet_provider: "BASTION",
            chain,
            action_input: actionInput,
            status: "CREATED",
            tag: "MINT_USDHIFI",
            bastion_transaction_record_id: walletProviderRecord.id
        }

        const record = await insertSingleContractActionRecord(mintRequestInfo)

        const mintActionInfo = {
            senderBastionUserId: gasStation,
            senderUserId: userId,
            contractAddress,
            actionName: "mint",
            chain,
            actionParams: actionInput,
            transferType: transferType.CONTRACT_ACTION,
            providerRecordId: walletProviderRecord.id
        }

        const {response, responseBody, mainTableStatus} = await submitWalletUserAction("BASTION", mintActionInfo)

        const toUpdateContractActionRecord = {
            status: mainTableStatus,
            updated_at: new Date().toISOString()
        }

        if (!response.ok){
            toUpdateContractActionRecord.failed_reason = responseBody.message || "Unknown error"
        }

        await updateContractActionRecord(record.id, toUpdateContractActionRecord)

        // update onramp record
        const toUpdateOnrampRecord = {
            status: responseBody.status == "SUBMITTED" || responseBody.status == "ACCEPTED" ? "FIAT_SUBMITTED" : "FAILED",
            updated_at: new Date().toISOString(),
            transaction_hash: responseBody.transactionHash
        }
        await updateOnrampTransactionRecord(onRampRecordId, toUpdateOnrampRecord)

        // insert mint check if success
        if (mainTableStatus == "SUBMITTED" || mainTableStatus == "ACCEPTED"){
            const newJogConfig = {...config, contractActionRecordId: record.id}
            if (!(await mintCheckScheduleCheck("mintCheck", newJogConfig, userId, profileId))) return
            const currentTime = new Date();
            currentTime.setSeconds(currentTime.getSeconds() + 30);
            const nextRetry = currentTime.toISOString()
            await createJob("mintCheck", newJogConfig, userId, profileId, currentTime.toISOString(), 0, nextRetry)
        }

    }catch (error){
        await createLog("asyncJob/mint", userId, error.message, error, profileId)
        // update onramp record
        const toUpdateOnrampRecord = {
            status: "FAILED",
            failed_reason: "Please contact HIFI for more information",
            updated_at: new Date().toISOString()
        }
        await updateOnrampTransactionRecord(onRampRecordId, toUpdateOnrampRecord)
        
        throw new Error("Failed to mint USDHIFI to user")
    }
}

module.exports = {
    mintCheck,
    mint
}