const { createBridgeBridging, acceptBridgeBridging, executeBridgeBridging } = require("./bridgeWithBridge")

const bridgingSupportedDestinationChain = process.env.NODE_ENV == "development" ? 
["POLYGON_AMOY", "ETHEREUM_TESTNET"] 
: 
["ETHEREUM_MAINNET", "ARBITRUM_MAINNET", "BASE_MAINNET", "ETHEREUM_MAINNET", "OPTIMISM_MAINNET"]

const bridgeFunctionMap = {
    universal: {
        createBridgingRequest: createBridgeBridging,
        acceptBridgingRequest: acceptBridgeBridging,
        executeBridging: executeBridgeBridging
    }
}

module.exports = {
    bridgeFunctionMap,
    bridgingSupportedDestinationChain
}