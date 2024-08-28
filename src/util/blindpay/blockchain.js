const blindpayChainMapping = {
	POLYGON_MAINNET: "polygon",
	POLYGON_AMOY: "sepolia", // sepolia is the network for Blindpay sandbox
	BASE_MAINNET: "base"
}

const getBlindpayChain = (chain) => {
    const blindpayChain = blindpayChainMapping[chain]
    if (!blindpayChain) throw new Error(`Chain ${chain} is not supported`)
    return blindpayChain
}
module.exports = {
	getBlindpayChain
}