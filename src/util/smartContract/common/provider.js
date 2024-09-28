const { AlchemyProvider } = require("ethers");
const { ChainId } = require("../../common/blockchain");

const result = require("dotenv").config({ path: `.env.production` });
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

const initAlchemyProvider = (chain) => {
    const chainId = ChainId[chain];
    return new AlchemyProvider(chainId, ALCHEMY_API_KEY);
}

module.exports = { initAlchemyProvider };