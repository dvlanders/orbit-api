const createLog = require("../../logger/supabaseLogger")
const { getUserBalance } = require("../endpoints/getUserBalance")
const { currencyContractAddress } = require("../../common/blockchain")
const { toUnitsString } = require("../../transfer/cryptoToCrypto/utils/toUnits")
const { getUserWalletBalance } = require("../../user/getUserWallet")

const checkBalanceForTransactionAmount = async (userId, amount, chain, currency, walletType="INDIVIDUAL") => {
    try{
        if(process.env.NODE_ENV === "development") return true;
        const walletBalance = await getUserWalletBalance(userId, chain, currency, walletType)
        console.log("walletBalance", walletBalance)
        const tokenInfo = walletBalance.tokenInfo
        if(!tokenInfo) return false;
        const balance = BigInt(walletBalance.balance);
        const unitAmount = BigInt(toUnitsString(amount, tokenInfo.decimals));
        
        return balance >= unitAmount;

    }catch (error){
        await createLog("checkBalanceForTransactionAmount", userId, error.message);
        return true; // if sth goes wrong when checking balance, we will just let them do the transaction since we are not sure whether they have enough balance or not
    }
}

module.exports = {
    checkBalanceForTransactionAmount
}