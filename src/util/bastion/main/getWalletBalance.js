const { currencyContractAddress, convertWeiToEthers } = require("../../common/blockchain");
const { safeParseBody } = require("../../utils/response");
const createLog = require("../../logger/supabaseLogger");
const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;


exports.getUserBalanceBastion = async(bastionUserId, chain, currency) => {
    const url = `${BASTION_URL}/v1/users/${bastionUserId}/balances?chain=${chain}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

    const response = await fetch(url, options);
    const responseBody = await safeParseBody(response)
    if (!response.ok) {
        await createLog("user/getUserWalletBalance", null, "Something went wrong when getting wallet balance", responseBody, null)
        throw new Error("Something went wrong when getting wallet balance")
    }

    // base asset
    if (currency == "gas"){
        return { 
            balance: responseBody.baseAssetBalance.quantity, 
            displayBalance: convertWeiToEthers(responseBody.baseAssetBalance.quantity, "18"),
            tokenInfo: {
                decimals: 18
            }	 
        }
    }

    // other assets
    const currencyContract = currencyContractAddress[chain][currency]?.toLowerCase();
    const tokenInfo = responseBody.tokenBalances[currencyContract];
    if (!tokenInfo) {
        return { balance: "0", displayBalance: "0.00", tokenInfo: null }
    }

    return {
        balance: tokenInfo.quantity,
        displayBalance: convertWeiToEthers(tokenInfo.quantity, tokenInfo.decimals),
        tokenInfo
    }
}