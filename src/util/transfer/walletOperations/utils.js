const { insertSingleBastionTransactionRecord } = require("../../bastion/main/bastionTransactionTableService")
const { insertSingleCircleTransactionRecord } = require("../../circle/main/circleTransactionTableService")
const { transferToAddressBastion } = require("./bastion/transferToAddress")
const { transferToAddressBastionWithPP } = require("./bastion/transferToAddressWithPP")
const { transferToAddressCircle } = require("./circle/transferToAddress")
const { transferToAddressCircleWithPP } = require("./circle/transferToAddressWithPP")
const { submitBastionUserAction } = require("./bastion/submitUserAction")
const { submitCircleUserAction } = require("./circle/submitUserAction")
const { getUserAction: getBastionUserAction } = require("./bastion/getUserAction")
const { getTransaction } = require("./circle/getTransaction")
const { approveActionBastion } = require("./bastion/approveAction")
const { approveActionCircle } = require("./circle/approveAction")

const walletTransferFunctionMap = {
    BASTION: {
        transfer: transferToAddressBastion,
        transferWithPP: transferToAddressBastionWithPP,
        approve: approveActionBastion,
        action: submitBastionUserAction,
        getAction: getBastionUserAction,
    },
    CIRCLE: {
        transfer: transferToAddressCircle,
        transferWithPP: transferToAddressCircleWithPP,
        approve: approveActionCircle,
        action: submitCircleUserAction,
        getAction: getTransaction,
    }
}

const providerRecordInsertFunctionMap = {
    BASTION: insertSingleBastionTransactionRecord,
    CIRCLE: insertSingleCircleTransactionRecord
}

const providerRecordColumnMap = {
    BASTION: "bastion_transaction_record_id",
    CIRCLE: "circle_transaction_record_id"
}

const getWalletColumnNameFromProvider = (provider) => {
    const colName = providerRecordColumnMap[provider];
    if(!colName) throw new Error(`Provider ${provider} not found in providerRecordColumnMap`);
    return colName;
}

const transferToWallet = async (provider, transferInfo) => {
    const { transfer } = walletTransferFunctionMap[provider];
    return await transfer(transferInfo);
}

const transferToWalletWithPP = async (provider, transferInfo) => {
    const { transferWithPP } = walletTransferFunctionMap[provider];
    return await transferWithPP(transferInfo);
}

const submitWalletUserAction = async (provider, actionInfo) => {
    const { action } = walletTransferFunctionMap[provider];
    return await action(actionInfo);
}

const getUserAction = async (provider, actionInfo) => {
    const { getAction } = walletTransferFunctionMap[provider];
    return await getAction(actionInfo);
}

const approveAction = async (provider, actionInfo) => {
    const { approve } = walletTransferFunctionMap[provider];
    return await approve(actionInfo);
}

const insertWalletTransactionRecord = async(provider, toInsert) => {
    const providerInsertFunction = providerRecordInsertFunctionMap[provider];
    const providerRecord = await providerInsertFunction(toInsert);
    return providerRecord;
}


module.exports = {
    walletTransferFunctionMap,
    providerRecordInsertFunctionMap,
    providerRecordColumnMap,
    getWalletColumnNameFromProvider,
    transferToWallet,
    transferToWalletWithPP,
    submitWalletUserAction,
    getUserAction,
    insertWalletTransactionRecord,
    approveAction
}