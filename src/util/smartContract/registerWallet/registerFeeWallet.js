const { v4 } = require("uuid");
const { paymentProcessorContractMap, paymentProcessorContractOwnerMap } = require("../approve/approveToken");
const createLog = require("../../logger/supabaseLogger");
const { insertContractActionRecord } = require("../insertContractActionRecord");
const { updateContractActionRecord } = require("../updateContractActionRecord");
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");
const { insertWalletTransactionRecord, submitWalletUserAction } = require("../../transfer/walletOperations/utils");
const { insertSingleContractActionRecord } = require("../../transfer/contractAction/contractActionTableService");
const { transferType } = require("../../transfer/utils/transfer");


exports.regsiterFeeWallet = async(userId, walletAddress, chain) => {
    try{

        const requestId = v4()
        const paymentProcessorContractOwner = paymentProcessorContractOwnerMap[process.env.NODE_ENV][chain]
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
        if (!paymentProcessorContractAddress) throw new Error(`No payment processor contract found on ${chain}`)
        if (!paymentProcessorContractOwner) throw new Error(`No payment processor contract owner found on ${chain}`)

        // insert provider record
        const toInsertProviderRecord = {
            user_id: userId,
            request_id: requestId,
            bastion_user_id: paymentProcessorContractOwner
        }

        const providerRecord = await insertWalletTransactionRecord("BASTION", toInsertProviderRecord)
        const actionInput = [
            {name: "feeWallet", value: walletAddress},
        ]
        // insert record
        const requestInfo = {
            user_id: userId,
            wallet_address: walletAddress,
            contract_address: paymentProcessorContractAddress,
            wallet_provider: "BASTION",
            chain,
            action_input: actionInput,
            tag: "REGISTER_FEE_WALLET_ON_PAYMENT_PROCESSOR_CONTRACT",
            bastion_transaction_record_id: providerRecord.id
        }
        const record = await insertSingleContractActionRecord(requestInfo)

        const actionConfig = {
            senderBastionUserId: paymentProcessorContractOwner, 
            senderUserId: userId, 
            contractAddress: paymentProcessorContractAddress, 
            actionName: "registerFeeWallet", 
            chain, 
            actionParams: actionInput, 
            transferType: transferType.CONTRACT_ACTION, 
            providerRecordId: providerRecord.id
        }

        const {response, responseBody, mainTableStatus} = await submitWalletUserAction("BASTION", actionConfig)

        let toUpdateContractActionRecord = {
            updated_at: new Date().toISOString(),
            status: mainTableStatus,
        }

        if (!response.ok){
            await createLog("regsiterFeeWallet", userId, responseBody.message, responseBody)
        }

        await updateContractActionRecord(record.id, toUpdateContractActionRecord)

    }catch(error){
        await createLog("regsiterFeeWallet", userId, error.message, error)
        return 
    }
}