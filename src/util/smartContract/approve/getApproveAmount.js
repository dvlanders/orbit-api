const { Chain, currencyContractAddress } = require("../../common/blockchain");
const createLog = require("../../logger/supabaseLogger");
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY

const urlMap = {
    ETHEREUM_MAINNET: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	OPTIMISM_MAINNET: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	POLYGON_MAINNET: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	ETHEREUM_TESTNET:`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	OPTIMISM_SEPOLIA: `https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	POLYGON_AMOY: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	BASE_MAINNET: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
}

exports.getTokenAllowance = async(chain, currency, owner, spender) => {
    const url = urlMap[chain]
    const options = {
    method: 'POST',
    headers: {accept: 'application/json', 'content-type': 'application/json'},
    body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getTokenAllowance',
        params: [
        {
            contract: currencyContractAddress[chain][currency],
            owner: owner,
            spender: spender
        }
        ]
    })
    };

    const response = await fetch(url, options)
    const responseBody = await response.json()
    if (!response.ok){
        await createLog("smartContract/approve/getAllowance", null, responseBody.message || responseBody.error, responseBody)
        throw new Error("Something happened when try to get token allowance from alchemy")
    }

    return BigInt(responseBody.result)
}


