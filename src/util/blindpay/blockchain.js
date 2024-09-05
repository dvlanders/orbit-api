const blindpayChainMapping = {
  POLYGON_MAINNET: "polygon",
  POLYGON_AMOY: "base_sepolia", // base_sepolia is the network for Blindpay sandbox
  BASE_MAINNET: "base",
};

const getBlindpayChain = (chain) => {
  const blindpayChain = blindpayChainMapping[chain];
  if (!blindpayChain)
    throw new Error(`Chain ${chain} is not supported for Blindpay`);
  return blindpayChain;
};

const getBlindpayToken = () => {
  return process.env.NODE_ENV == "development" ? "USDB" : "USDC";
}

const blindpayContractAddressMapping = {
  POLYGON_MAINNET: {
    usdc: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // registered
  },
  BASE_SEPOLIA: {
    usdc: "0x4D423D2cfB373862B8E12843B6175752dc75f795", // registered
  },
  POLYGON_AMOY: {
    usdc: "0x4D423D2cfB373862B8E12843B6175752dc75f795", // registered
  },
};

const getBlindpayContractAddress = (chain, currency) => {
  const contractAddress = blindpayContractAddressMapping[chain][currency];
  if (!contractAddress)
    throw new Error(
      `Currency ${currency} on chain ${chain} is not supported for Blindpay`
    );
  return contractAddress;
};
module.exports = {
  getBlindpayChain,
  getBlindpayToken,
  getBlindpayContractAddress,
};
