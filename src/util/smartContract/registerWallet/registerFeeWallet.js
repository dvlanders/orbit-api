const { v4 } = require("uuid");
const { paymentProcessorContractMap, paymentProcessorContractOwnerMap } = require("../approve/approveTokenBastion");
const createLog = require("../../logger/supabaseLogger");
const { insertContractActionRecord } = require("../insertContractActionRecord");
const { updateContractActionRecord } = require("../updateContractActionRecord");
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");


exports.regsiterFeeWallet = async(userId, walletAddress, chain) => {
    try{

        const requestId = v4()
        const paymentProcessorContractAddress = paymentProcessorContractMap["production"][chain]
        const paymentProcessorContractOwner = paymentProcessorContractOwnerMap["production"][chain]
        if (!paymentProcessorContractAddress) throw new Error(`No payment processor contract found on ${chain}`)
        if (!paymentProcessorContractOwner) throw new Error(`No payment processor contract found on ${chain}`)

        const bodyObject = {
            requestId,
            userId: paymentProcessorContractOwner,
            contractAddress: paymentProcessorContractAddress,
            actionName: "registerFeeWallet",
            chain: chain,
            actionParams: [
                {name: "feeWallet", value: walletAddress},
            ]
        };

        // insert record
        const requestInfo = {
            bastionRequestId: requestId,
            userId,
            walletAddress: walletAddress,
            contractAddress: paymentProcessorContractAddress,
            provider: "BASTION",
            chain,
            actionInput: bodyObject,
            tag: "REGISTER_FEE_WALLET_ON_PAYMENT_PROCESSOR_CONTRACT",
            bastionUserId: paymentProcessorContractOwner
        }
        const record = await insertContractActionRecord(requestInfo)

        const response = await submitUserAction(bodyObject)
        const responseBody = await response.json()
        let toUpdate

        if (response.ok){
            toUpdate = {
                bastion_response: responseBody,
                status: responseBody.status,
                bastion_status: responseBody.status,
                transaction_hash: responseBody.transactionHash,
                updated_at: new Date().toISOString()
            }
        }else{
            await createLog("regsiterFeeWallet", userId, responseBody.message, responseBody)
            toUpdate = {
                bastion_response: responseBody,
                status: "FAILED",
                bastion_status: "FAILED",
                updated_at: new Date().toISOString()
            }
        }

        await updateContractActionRecord(record.id, toUpdate)

    }catch(error){
        await createLog("regsiterFeeWallet", userId, error.message, error)
        return 
    }
}