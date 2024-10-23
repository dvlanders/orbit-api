const { generateCypherText } = require("../utils/generateCypherText")
const { fetchWithLogging } = require("../../logger/fetchLogger")

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

const submitTransactionCircle = async (referenceId, requestId, walletId, contractAddress, functionName, params) => {
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
            abiFunctionSignature: functionName,
            abiParameters: params,
            ContractAddress: contractAddress,
            walletId: walletId,
            entitySecretCiphertext: generateCypherText(),
            feeLevel: "MEDIUM",
            refId: referenceId
        })
    }
    const response = await fetchWithLogging(url, options)
    return response
}

module.exports = {
    submitTransactionCircle
}