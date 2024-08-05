const { bastionCryptoTransfer, bastionCryptoTransferDeveloperWithdraw } = require("../main/bastionTransfer")

/**
transfer information should include
userId, currency, chain, amout, recipientAddress, contractAddress, requestId, recipientUserId
*/
const cryptoToCryptoSupportedFunctions = {
    POLYGON_MAINNET: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: bastionCryptoTransfer,
            developerWithdrawFunc: bastionCryptoTransferDeveloperWithdraw
        }
    },
    POLYGON_AMOY: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: bastionCryptoTransfer,
            developerWithdrawFunc: bastionCryptoTransferDeveloperWithdraw
        }
    },
    ETHEREUM_TESTNET:{
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: bastionCryptoTransfer,
            developerWithdrawFunc: bastionCryptoTransferDeveloperWithdraw
        }
    }
}

module.exports = cryptoToCryptoSupportedFunctions