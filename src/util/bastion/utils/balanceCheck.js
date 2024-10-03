const createLog = require("../../logger/supabaseLogger")
const { getUserBalance } = require("../endpoints/getUserBalance")
const { currencyContractAddress } = require("../../common/blockchain")
const { toUnitsString } = require("../../transfer/cryptoToCrypto/utils/toUnits")

const checkBalanceForTransactionAmount = async (bastionUserId, amount, chain, currency) => {
    try{
        if(process.env.NODE_ENV === "development") return true;
		const response = await getUserBalance(bastionUserId, chain);
		const responseBody = await response.json();

		if (!response.ok) {
			await createLog("checkBalanceForTransactionAmount", null, `Something went wrong when getting wallet balance for bastionUserId: ${bastionUserId}`, responseBody);
            return true; // if sth goes wrong when checking balance, we will just let them do the transaction since we are not sure whether they have enough balance or not
		}

        const currencyContract = currencyContractAddress[chain][currency]?.toLowerCase();
        if (!currencyContract) return true; // if currency not found, which should not have happened, return enough balance

        const tokenInfo = responseBody.tokenBalances[currencyContract];
        if (!tokenInfo) return false; // if no tokenInfo on the wallet address, means not enough balance

        const balance = BigInt(tokenInfo.quantity);
        const unitAmount = BigInt(toUnitsString(amount, tokenInfo.decimals));
        
        return balance >= unitAmount;

    }catch (error){
        await createLog("checkBalanceForTransactionAmount", null, error.message);
        return true; // if sth goes wrong when checking balance, we will just let them do the transaction since we are not sure whether they have enough balance or not
    }
}

module.exports = {
    checkBalanceForTransactionAmount
}