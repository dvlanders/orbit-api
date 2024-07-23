const createJob = require("../../../../asyncJobs/createJob");
const { fundGasScheduleCheck } = require("../../../../asyncJobs/wallets/fundGas");
const createLog = require("../../logger/supabaseLogger");

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;
const GAS_THRESHOLD = BigInt(5 * Math.pow(10, 16))

const bastionGasCheck = async(userId, chain) => {
    try{
        const url = `${BASTION_URL}/v1/users/${userId}/balances?chain=${chain}`
        const options = {
			method: 'GET',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				Authorization: `Bearer ${BASTION_API_KEY}`
			}
		};

        const response = await fetch(url, options)
        const responseBody = await response.json()

        if (!response.ok){
            createLog("transfer/util/bastionGasCheck", userId, "error happened when checking gas", responseBody)
            return
        }

        const gasLeft = responseBody.baseAssetBalance.quantity
        // fund 0.1 eth when gas is less than 0.01
        if (BigInt(gasLeft) < GAS_THRESHOLD){
            const canSchedule = await fundGasScheduleCheck("fundGas", {userId, chain, amount: "0.1"}, userId)
            if (canSchedule){
                await createJob("fundGas", {userId, chain, amount: "0.1"}, userId)
            }
        }

        return
    }catch(error){
        createLog("transfer/util/bastionGasCheck", userId, error.message)
        return
    }
}

module.exports = bastionGasCheck