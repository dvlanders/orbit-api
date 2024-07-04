const {fundGas, fundGasScheduleCheck} = require("./wallets/fundGas");


const jobMapping = {
    fundGas: {
        scheduleCheck: fundGasScheduleCheck,
        execute: fundGas
    }
}

module.exports = jobMapping