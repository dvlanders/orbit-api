const createJob = require("../../../../../asyncJobs/createJob");
const { fundGasScheduleCheck } = require("../../../../../asyncJobs/wallets/fundGas");
const { Chain } = require("../../../common/blockchain");
const createLog = require("../../../logger/supabaseLogger");
const { getUserWallet, getUserWalletBalance } = require("../../../user/getUserWallet");

const gasSupportedChain = [Chain.POLYGON_MAINNET, Chain.ETHEREUM_MAINNET]
const gasAmount = {
    POLYGON_MAINNET: "0.1",
    ETHEREUM_MAINNET: "0.006"
}

const gasThreshold = {
    POLYGON_MAINNET: BigInt(5 * Math.pow(10, 16)),
    ETHEREUM_MAINNET: BigInt(4 * Math.pow(10, 15))
}


const gasCheck = async(userId, chain, walletType="INDIVIDUAL", profileId) => {
    try{
        if(chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET){
            console.log(`Don't check gas for TESTNET ${chain}`);
            return {needFund: false, fundSubmitted: false, error: false}
        }

        if (!gasSupportedChain.includes(chain)){
            await createLog("transfer/util/gasCheck", userId, `Unsupported chain ${chain} for gas, skipping`, null)
            return {needFund: false, fundSubmitted: false, error: false}
        }

        //get wallet gas balance
        const balance = await getUserWalletBalance(userId, chain, "gas", walletType)

        const gasLeft = balance.balance
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
        await createLog("transfer/util/gasCheck", userId, error.message, error)
        return {needFund: false, fundSubmitted: false, error: true}
    }
}

module.exports = {
    gasCheck
}