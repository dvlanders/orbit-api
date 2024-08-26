const createJob = require("../../../../asyncJobs/createJob");
const { fundGasScheduleCheck } = require("../../../../asyncJobs/wallets/fundGas");
const createLog = require("../../logger/supabaseLogger");
const { Chain } = require("../../common/blockchain");

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const gasAmount = {
    POLYGON_MAINNET: "0.1",
    ETHEREUM_MAINNET: "0.001"
}

const gasThreshold = {
    POLYGON_MAINNET: BigInt(5 * Math.pow(10, 16)),
    ETHEREUM_MAINNET: BigInt(5 * Math.pow(10, 14))
}

const bastionGasCheck = async(userId, chain, walletType="INDIVIDUAL") => {
    try{
        if(chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET){
            console.log(`Don't check gas for TESTNET ${chain}`);
            return {needFund: false, fundSubmitted: false, error: false}
        }

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
            await createLog("transfer/util/bastionGasCheck", userId, "error happened when checking gas", responseBody)
            return {needFund: false, fundSubmitted: false, error: true}
        }

        const gasLeft = responseBody.baseAssetBalance.quantity
        // fund 0.1 eth when gas is less than 0.01
        if (BigInt(gasLeft) < gasThreshold[chain]){
            const canSchedule = await fundGasScheduleCheck("fundGas", {userId, chain, amount: gasAmount[chain], walletType}, userId)
            if (canSchedule){
                await createJob("fundGas", {userId, chain, amount: gasAmount[chain], walletType}, userId)
            }
            return {needFund: true, fundSubmitted: true, error: false}
        }

        return {needFund: false, fundSubmitted: false, error: false}
    }catch(error){
        await createLog("transfer/util/bastionGasCheck", userId, error.message, error)
        return {needFund: false, fundSubmitted: false, error: true}
    }
}

module.exports = bastionGasCheck