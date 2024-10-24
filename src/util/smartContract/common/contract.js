const { AlchemyProvider, BaseContract } = require("ethers");
const { ChainId } = require("../../common/blockchain");
const { ContractAbi } = require("../contractAbi");
const { initAlchemyProvider } = require("./provider");


const initContractInstance = (chain, contractAddress) => {
    const abi = ContractAbi[contractAddress.toLowerCase()]
    if (!abi) {
        throw new Error("Contract ABI not found for address: " + contractAddress)
    }
    const provider = initAlchemyProvider(chain);
    const contract = new BaseContract(contractAddress, abi, provider);
    return contract;
}

module.exports = { initContractInstance };