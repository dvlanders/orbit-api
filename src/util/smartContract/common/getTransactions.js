const { initContractInstance } = require("./contract");
const { Chain } = require("../../common/blockchain");
const { initAlchemyProvider } = require("./provider");



const getTransactionsOfContractByFilter = async (chain, contractAddress, filter) => {
    const contract = initContractInstance(chain, contractAddress);
    const records = await contract.queryFilter(filter);
    return records;
}

const getTransactionsOfContractByEventName = async (chain, contractAddress, eventName) => {
    return await getTransactionsOfContractByFilter(chain, contractAddress, eventName);
}

const getTransactionByHash = async (chain, transactionHash) => {
    const provider = initAlchemyProvider(chain);
    const transaction = await provider.getTransaction(transactionHash);
    return transaction;
}

const getTransactionReceiptByHash = async (chain, transactionHash) => {
    const provider = initAlchemyProvider(chain);
    const transaction = await provider.getTransactionReceipt(transactionHash);
    return transaction;
}

module.exports = { getTransactionsOfContractByEventName, getTransactionsOfContractByFilter, getTransactionByHash, getTransactionReceiptByHash };
