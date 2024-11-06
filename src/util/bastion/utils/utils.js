const BastionTransferStatus = {
    ACCEPTED: "ACCEPTED",
    SUBMITTED: "SUBMITTED",
    CONFIRMED: "CONFIRMED",
    FAILED: "FAILED",
    PENDING: "PENDING"
}

// only for EVM
const BastionSupportedEVMChainProd =  ["POLYGON_MAINNET", "ETHEREUM_MAINNET", "BASE_MAINNET", "OPTIMISM_MAINNET"]
const BastionSupportedEVMChainSandbox =  ["POLYGON_AMOY", "ETHEREUM_TESTNET", "BASE_SEPOLIA", "OPTIMISM_SEPOLIA"]


const currencySymbolMap = {
	"ETHEREUM_MAINNET": "ETH",
	"POLYGON_MAINNET": "MATIC"
}

module.exports = {
    BastionTransferStatus,
    BastionSupportedEVMChainProd,
    BastionSupportedEVMChainSandbox,
    currencySymbolMap
}