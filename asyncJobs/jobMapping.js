const { createUserAsyncCheck, createUserAsync } = require("./user/createUser");
const {fundGas, fundGasScheduleCheck} = require("./wallets/fundGas");
const {updateUserAsyncCheck, updateUserAsync} = require("./user/updateUser");
const {createDeveloperUserAsyncCheck, createDeveloperUserAsync} = require("./user/createDeveloperUser")
const {approveMaxTokenToPaymentProcessorAsyncCheck, approveMaxTokenToPaymentProcessorAsync} = require("./wallets/approveMaxToPaymentProcessor")
const {cryptoToCryptoTransferAsync, cryptoToCryptoTransferScheduleCheck} = require("./transfer/cryptoToCryptoTransfer")

exports.jobMapping = {
    fundGas: {
        scheduleCheck: fundGasScheduleCheck,
        execute: fundGas
    },
    createUser: {
        scheduleCheck: createUserAsyncCheck,
        execute: createUserAsync
    },
    updateUser: {
        scheduleCheck: updateUserAsyncCheck,
        execute: updateUserAsync
    },
    createDeveloperUser: {
        scheduleCheck: createDeveloperUserAsyncCheck,
        execute: createDeveloperUserAsync
    },
    approveMaxTokenToPaymentProcessor: {
        scheduleCheck: approveMaxTokenToPaymentProcessorAsyncCheck,
        execute: approveMaxTokenToPaymentProcessorAsync
    },
    cryptoToCryptoTransfer: {
        scheduleCheck: cryptoToCryptoTransferScheduleCheck,
        execute: cryptoToCryptoTransferAsync
    },
    testJob: {
        scheduleCheck: () => {return true},
        execute: () => {return true},
    }
}

