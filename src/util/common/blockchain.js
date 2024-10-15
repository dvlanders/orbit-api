const { formatUnits } = require("ethers")

const NODE_ENV = process.env.NODE_ENV

const Chain = {
	ETHEREUM_MAINNET: "ETHEREUM_MAINNET",
	OPTIMISM_MAINNET: "OPTIMISM_MAINNET",
	POLYGON_MAINNET: "POLYGON_MAINNET",
	ETHEREUM_TESTNET: "ETHEREUM_TESTNET",
	OPTIMISM_SEPOLIA: "OPTIMISM_SEPOLIA",
	POLYGON_AMOY: "POLYGON_AMOY",
	BASE_MAINNET: "BASE_MAINNET"

}

const ChainId = {
	ETHEREUM_MAINNET: 1,
	OPTIMISM_MAINNET: 10,
	POLYGON_MAINNET: 137,
	ETHEREUM_TESTNET: 11155111,
	OPTIMISM_SEPOLIA: 11155420,
	POLYGON_AMOY: 80002,
	BASE_MAINNET: 8453
}
const hifiSupportedChain = NODE_ENV == "development" ?
	[Chain.ETHEREUM_TESTNET, Chain.POLYGON_AMOY] : [Chain.POLYGON_MAINNET, Chain.ETHEREUM_MAINNET] // FIXME: remove Chain.POLYGON_MAINNET from development

const currencyDecimal = {
	"usdc": 6,
	"usdt": 6,
	"usdHifi": 6
}

const currencyContractAddress = {
	POLYGON_MAINNET: {
		usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" //registered
	},
	ETHEREUM_TESTNET: {
		usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", //registered
		usdHifi: process.env.ETHEREUM_SEPOLIA_USDHIFI_CONTRACT_ADDRESS //registered
	},
	POLYGON_AMOY: {
		usdc: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582", //registered
		usdHifi: process.env.POLYGON_AMOY_USDHIFI_CONTRACT_ADDRESS //registered
	},
	BASE_MAINNET: {
		usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" //registered
	},
	ETHEREUM_MAINNET: {
		usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", //registered
		usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7" //registered
	},
	OPTIMISM_MAINNET: {
		usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" //registered
	}
}

const baseAssetMap = {
	ETHEREUM_MAINNET: "ETH",
	POLYGON_MAINNET: "MATIC",
	ETHEREUM_TESTNET: "ETH",
	POLYGON_AMOY: "MATIC",
}

const convertWeiToEthers = (wei, decimals="0", toFixed=2) => {
    const _wei = BigInt(wei)
    const ether = formatUnits(_wei, parseInt(decimals))
    const [int, dic] = ether.split(".")

    const formated = `${int}.${dic ? dic.slice(0, toFixed) : "00"}`
    return formated
}


module.exports = {
	Chain,
	hifiSupportedChain,
	currencyDecimal,
	currencyContractAddress,
	baseAssetMap,
	convertWeiToEthers,
	ChainId
}