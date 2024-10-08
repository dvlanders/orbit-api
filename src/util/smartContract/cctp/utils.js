const { ethers } = require("ethers");

// registered in bastion
const tokenMessenger = {
    "ETHEREUM_TESTNET": {
      domain: 0,
      address: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"
    },
    "OPTIMISM_SEPOLIA": {
      domain: 2,
      address: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"
    },
    "BASE_SEPOLIA": {
      domain: 6,
      address: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"
    },
    "POLYGON_AMOY": {
      domain: 7,
      address: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"
    },
    "ETHEREUM_MAINNET": {
    domain: 0,
    address: "0xbd3fa81b58ba92a82136038b25adec7066af3155"
  },
  "OPTIMISM_MAINNET": {
    domain: 2,
    address: "0x2B4069517957735bE00ceE0fadAE88a26365528f"
  },
  "BASE_MAINNET": {
    domain: 6,
    address: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962"
  },
  "POLYGON_MAINNET": {
        domain: 7,
        address: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE"
    }
};

// registered in bastion
const messageTransmitter = {
    "ETHEREUM_TESTNET": {
      domain: 0,
      address: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD"
    },
    "OPTIMISM_SEPOLIA": {
      domain: 2,
      address: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD"
    },
    "BASE_SEPOLIA": {
      domain: 6,
      address: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD"
    },
    "POLYGON_AMOY": {
      domain: 7,
      address: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD"
    },
    "ETHEREUM_MAINNET": {
        domain: 0,
        address: "0x0a992d191deec32afe36203ad87d7d289a738f81"
    },
    "OPTIMISM_MAINNET": {
        domain: 2,
        address: "0x4d41f22c5a0e5c74090899e5a8fb597a8842b3e8"
    },
    "BASE_MAINNET": {
        domain: 6,
        address: "0xAD09780d193884d503182aD4588450C416D6F9D4"
      },
      "POLYGON_MAINNET": {
        domain: 7,
        address: "0xF3be9355363857F3e001be68856A2f96b4C39Ba9"
      }
  };


  const tokenMinter = {
    "ETHEREUM_TESTNET": {
      domain: 0,
      address: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A"
    },
    "OPTIMISM_SEPOLIA": {
      domain: 2,
      address: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A"
    },
    "BASE_SEPOLIA": {
      domain: 6,
      address: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A"
    },
    "POLYGON_AMOY": {
      domain: 7,
      address: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A"
    },
    "ETHEREUM_MAINNET": {
    domain: 0,
    address: "0xc4922d64a24675e16e1586e3e3aa56c06fabe907"
  },
  "OPTIMISM_MAINNET": {
    domain: 2,
    address: "0x33E76C5C31cb928dc6FE6487AB3b2C0769B1A1e3"
  },
  "BASE_MAINNET": {
    domain: 6,
    address: "0xe45B133ddc64bE80252b0e9c75A8E74EF280eEd6"
  },
  "POLYGON_MAINNET": {
    domain: 7,
    address: "0x10f7835F827D6Cf035115E10c50A853d7FB2D2EC"
  }
  };

  // reference: https://etherscan.io/address/0xb2f38107a18f8599331677c14374fd3a952fb2c8#code
  function addressToBytes32(addr) {
    return ethers.zeroPadValue(addr, 32)
  }

  module.exports = {
    tokenMessenger,
    messageTransmitter,
    tokenMinter,
    addressToBytes32
  }
  

