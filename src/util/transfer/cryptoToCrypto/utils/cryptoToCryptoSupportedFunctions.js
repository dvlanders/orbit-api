const { createBastionCryptoTransfer } = require("../main/bastionTransfer")
const { createBastionSandboxCryptoTransfer } = require("../main/bastionTransfeSandboxUSDHIFI")

/**
transfer information should include
userId, currency, chain, amout, recipientAddress, contractAddress, requestId, recipientUserId
*/
const cryptoToCryptoSupportedFunctions = {
    POLYGON_MAINNET: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: createBastionCryptoTransfer,
        }
    },
    ETHEREUM_MAINNET: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: createBastionCryptoTransfer,
        },
        usdt: {
            walletProviderTable: "bastion_wallets",
            transferFunc: createBastionCryptoTransfer,
        }
    },
    POLYGON_AMOY: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: createBastionCryptoTransfer,
        },
        usdHifi: {
            walletProviderTable: "bastion_wallets",
            transferFunc: createBastionSandboxCryptoTransfer,
        }
    },
    ETHEREUM_TESTNET:{
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: createBastionCryptoTransfer,
        },
        usdHifi: {
            walletProviderTable: "bastion_wallets",
            transferFunc: createBastionSandboxCryptoTransfer,
        }
    }
}

module.exports = cryptoToCryptoSupportedFunctions