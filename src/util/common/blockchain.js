const NODE_ENV = process.env.NODE_ENV

const Chain = {
	ETHEREUM_MAINNET: "ETHEREUM_MAINNET",
	OPTIMISM_MAINNET: "OPTIMISM_MAINNET",
	POLYGON_MAINNET: "POLYGON_MAINNET",
	ETHEREUM_TESTNET: "ETHEREUM_TESTNET",
	OPTIMISM_SEPOLIA: "OPTIMISM_SEPOLIA",
	POLYGON_AMOY: "POLYGON_AMOY",
}

const hifiSupportedChain = NODE_ENV == "development" ?
 [Chain.ETHEREUM_TESTNET, Chain.POLYGON_AMOY] : [Chain.POLYGON_MAINNET]

const currencyDecimal = {
	"usdc": 6
}

const currencyContractAddress = {
	POLYGON_MAINNET: {
		usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
	},
	ETHEREUM_TESTNET: {
		usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
	},
	POLYGON_AMOY: {
		usdc: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"
	}
}


module.exports = {
	Chain,
	hifiSupportedChain,
	currencyDecimal,
	currencyContractAddress
}