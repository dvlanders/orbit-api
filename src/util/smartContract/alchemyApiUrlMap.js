const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY


exports.urlMap = {
    ETHEREUM_MAINNET: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	OPTIMISM_MAINNET: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	POLYGON_MAINNET: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	ETHEREUM_TESTNET:`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	OPTIMISM_SEPOLIA: `https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	POLYGON_AMOY: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
	BASE_MAINNET: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
}