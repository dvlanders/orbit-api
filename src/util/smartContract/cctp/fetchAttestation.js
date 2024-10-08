const { keccak256, AbiCoder, id } = require("ethers")
const { getTransactionReceiptByHash } = require("../common/getTransactions")
const { safeParseBody } = require("../../utils/response")

const circleUrl = process.env.NODE_ENV === "development" ? "https://iris-api-sandbox.circle.com" : "https://iris-api.circle.com"

const fetchAttestation = async (chain, transactionHash) => {
    const transaction = await getTransactionReceiptByHash(chain, transactionHash)
    if (!transaction) throw new Error("Transaction not found")
    
    // fetch message
    const functionTopic = id('MessageSent(bytes)')
    const log = transaction.logs.find((log) => log.topics[0] === functionTopic)
    if (!log) throw new Error("Log not found")
    const messageBytes = AbiCoder.defaultAbiCoder().decode(['bytes'], log.data)[0]
    const messageHash = keccak256(messageBytes)

    // fetch attestation from Circle
    const response = await fetch(`${circleUrl}/attestations/${messageHash}`);
    const attestationResponse = await safeParseBody(response)
    const confirmed = attestationResponse.status === 'complete'
    const attestationSignature = attestationResponse.attestation
    return { confirmed, attestationSignature, messageBytes }
}

module.exports = { fetchAttestation }