const { insertSingleBastionTransactionRecord } = require("../../bastion/main/bastionTransactionTableService")
const { insertSingleCircleTransactionRecord } = require("../../circle/main/circleTransactionTableService")
const { transferToAddressBastion } = require("./bastion/transferToAddress")
const { transferToAddressBastionWithPP } = require("./bastion/transferToAddressWithPP")
const { transferToAddressCircle } = require("./circle/transferToAddress")
const { transferToAddressCircleWithPP } = require("./circle/transferToAddressWithPP")

const walletTransferFunctionMap = {
    BASTION: {
        transfer: transferToAddressBastion,
        transferWithPP: transferToAddressBastionWithPP
    },
    CIRCLE: {
        transfer: transferToAddressCircle,
        transferWithPP: transferToAddressCircleWithPP
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

module.exports = {
    walletTransferFunctionMap,
    providerRecordInsertFunctionMap,
    providerRecordColumnMap
}