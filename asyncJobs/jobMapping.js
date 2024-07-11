const { createUserAsyncCheck, createUserAsync } = require("./user/createUser");
const {fundGas, fundGasScheduleCheck} = require("./wallets/fundGas");
const {updateUserAsyncCheck, updateUserAsync} = require("./user/updateUser")

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
    }
}

module.exports = jobMapping