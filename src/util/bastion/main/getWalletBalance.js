const { currencyContractAddress } = require("../../common/blockchain");
const { safeParseBody } = require("../../utils/response");
const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;


exports.getUserBalanceBastion = async(bastionUserId, chain, currency) => {
    const currencyContract = currencyContractAddress[chain][currency]?.toLowerCase();
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
        createLog("user/getUserWalletBalance", userId, "Something went wrong when getting wallet balance", responseBody, null, res)
        throw new Error("Something went wrong when getting wallet balance")
    }

    const tokenInfo = responseBody.tokenBalances[currencyContract];
    if (!tokenInfo) {
        return { balance: "0", displayBalance: "0.00", tokenInfo: null }
    }

    // Calculate the display balance by adjusting for the decimal places
    const displayBalance = (Number(tokenInfo.quantity) / Math.pow(10, tokenInfo.decimals)).toFixed(2);

    return {
        balance: tokenInfo.quantity,
        displayBalance,  // Adding the formatted balance for easier reading
        tokenInfo
    }
}