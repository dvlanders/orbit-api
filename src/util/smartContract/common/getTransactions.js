const { ethers, AlchemyProvider, BaseContract } = require("ethers");
const abi = require("../paymentProcessor/abi.json");
const { ChainId, Chain } = require("../../common/blockchain");
const { ContractAbi } = require("../contractAbi");

const result = require("dotenv").config({ path: `.env.production` });
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;


const getTransactionsOfContract = async (chain, contractAddress, filter) => {
    try {
        const chainId = ChainId[chain];
        const abi = ContractAbi[contractAddress.toLowerCase()]
        const provider = new AlchemyProvider(chainId, ALCHEMY_API_KEY);
        const contract = new BaseContract(contractAddress, abi, provider);
        const records = await contract.queryFilter(filter);
        console.log(records.length);
    } catch (error) {
        console.log(error);
    }
}

const getTransactionsOfContractByEventName = async (chain, contractAddress, eventName) => {
    return await getTransactionsOfContract(chain, contractAddress, eventName);
}

module.exports = { getTransactionsOfContractByEventName, getTransactionsOfContract };

const main = async () => {
    await getTransactionsOfContractByEventName(Chain.POLYGON_MAINNET, "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "Transfer");
}

main().catch((error) => {
    console.log(error);
});