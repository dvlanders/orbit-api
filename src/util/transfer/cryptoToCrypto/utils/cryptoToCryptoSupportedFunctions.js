const { bastionCryptoTransfer } = require("../main/bastionTransfer")

/**
transfer information should include
userId, currency, chain, amout, recipientAddress, contractAddress, requestId, recipientUserId
*/
const cryptoToCryptoSupportedFunctions = {
    POLYGON_MAINNET: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: bastionCryptoTransfer
        }
    },
    POLYGON_AMOY: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: bastionCryptoTransfer
        }
    },
    ETHEREUM_TESTNET:{
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: bastionCryptoTransfer
        }
    }
}

module.exports = cryptoToCryptoSupportedFunctions