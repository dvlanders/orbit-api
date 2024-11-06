const { generateCypherText } = require("../utils/generateCypherText")
const { fetchWithLogging } = require("../../logger/fetchLogger")
const { blockchainToCircleChain } = require("../utils/chainConvert")

/*
Example request body:
{
    "idempotencyKey": v4(),
    "abiFunctionSignature": "transfer(address, uint256)",
    "abiParameters": ["0xB1Ec8F89EFD7363A1B939bFe545d2Fca01Bb7381", "1000000"],
    "ContractAddress": contractAddress,
    "walletId": walletId,
    "entitySecretCiphertext": generateCypherText(),
    "feeLevel": "MEDIUM"
}

*/

const submitTransferTransactionCircle = async (referenceId, requestId, walletId, chain, amountInEther, destinationAddress) => {
    const url = `${process.env.CIRCLE_WALLET_URL}/v1/w3s/developer/transactions/contractExecution`
    const options = {
        method: "POST",
        headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": `Bearer ${process.env.CIRCLE_WALLET_API_KEY}`
        },
        body: JSON.stringify({
            idempotencyKey: requestId,
            walletId: walletId,
            entitySecretCiphertext: generateCypherText(),
            feeLevel: "MEDIUM",
            refId: referenceId,
            blockChain: chain,
            amounts: [amountInEther]
        })
    }
    const response = await fetchWithLogging(url, options, "CIRCLE")
    return response
}

module.exports = {
    submitTransferTransactionCircle
}