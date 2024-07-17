const { createUserAsyncCheck, createUserAsync } = require("./user/createUser");
const {fundGas, fundGasScheduleCheck} = require("./wallets/fundGas");
const {updateUserAsyncCheck, updateUserAsync} = require("./user/updateUser");
const {createDeveloperUserAsyncCheck, createDeveloperUserAsync} = require("./user/createDeveloperUser")

const jobMapping = {
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
    }
}

module.exports = jobMapping