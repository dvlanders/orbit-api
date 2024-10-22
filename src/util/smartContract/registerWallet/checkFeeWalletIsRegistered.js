const { ethers, Contract, JsonRpcProvider } = require("ethers");
const { urlMap } = require("../alchemyApiUrlMap");
const { paymentProcessorContractMap } = require("../approve/approveToken");

const abi = [
    "function isFeeWalletRegistered(address feeWallet) view returns (bool)"
]

exports.isFeeWalletRegistered = async(chain, walletAddress) => {
    const url = urlMap[chain]
    const provider = new JsonRpcProvider(url)
    const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
    if (!paymentProcessorContractAddress) return true
    const contract = new Contract(paymentProcessorContractAddress, abi, provider)

    const isRegistered = await contract.isFeeWalletRegistered(walletAddress)
    return isRegistered
}