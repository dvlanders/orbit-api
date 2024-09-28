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

const main = async () => {
    await getTransactionsOfContractByEventName(Chain.POLYGON_MAINNET, "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "Transfer");
}

main().catch((error) => {
    console.log(error);
});