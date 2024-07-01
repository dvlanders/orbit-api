const transferToBridgeLiquidationAddress = require("../transfer/transferToBridgeLiquidationAddress");

const CryptoToBankSupportedPairFunctions = {
	"usdc-usd": {
		transferFunc: transferToBridgeLiquidationAddress,
	},
	"usdc-eur": {
		transferFunc: transferToBridgeLiquidationAddress,
	}
}

module.exports = CryptoToBankSupportedPairFunctions