const createJob = require("../../../../asyncJobs/createJob");
const createLog = require("../../logger/supabaseLogger");
const { Chain } = require("../../common/blockchain");
const { getBastionWallet } = require("./getBastionWallet");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const gasAmount = {
    POLYGON_MAINNET: "0.1",
    ETHEREUM_MAINNET: "0.006"
}

const gasThreshold = {
    POLYGON_MAINNET: BigInt(5 * Math.pow(10, 16)),
    ETHEREUM_MAINNET: BigInt(4 * Math.pow(10, 15))
}

const gasSupportedChain = [Chain.POLYGON_MAINNET, Chain.ETHEREUM_MAINNET]

const bastionGasCheck = async(userId, chain, walletType="INDIVIDUAL", profileId) => {
    try{
        if(chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET){
            console.log(`Don't check gas for TESTNET ${chain}`);
            return {needFund: false, fundSubmitted: false, error: false}
        }

        if (!gasSupportedChain.includes(chain)){
            await createLog("transfer/util/bastionGasCheck", userId, `Unsupported chain ${chain} for gas, skipping`, null)
            return {needFund: false, fundSubmitted: false, error: false}
        }

        // get user bastion user id
        const { bastionUserId } = await getBastionWallet(userId, chain, walletType)

        const url = `${BASTION_URL}/v1/users/${bastionUserId}/balances?chain=${chain}`
        const options = {
			method: 'GET',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				Authorization: `Bearer ${BASTION_API_KEY}`
			}
		};

        const response = await fetchWithLogging(url, options, "BASTION")
        const responseBody = await response.json()

        if (!response.ok){
            await createLog("transfer/util/bastionGasCheck", userId, "error happened when checking gas", responseBody)
            return {needFund: false, fundSubmitted: false, error: true}
        }

        const gasLeft = responseBody.baseAssetBalance.quantity
        // fund 0.1 eth when gas is less than 0.01
        if (BigInt(gasLeft) <= gasThreshold[chain]){
            const jobConfig = {
                userId, chain, amount: gasAmount[chain], walletType, profileId
            }
            await createJob("fundGas", jobConfig, userId, profileId)
            return {needFund: true, fundSubmitted: true, error: false}
        }

        return {needFund: false, fundSubmitted: false, error: false}
    }catch(error){
        await createLog("transfer/util/bastionGasCheck", userId, error.message, error)
        return {needFund: false, fundSubmitted: false, error: true}
    }
}

module.exports = bastionGasCheck