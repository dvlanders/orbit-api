const { createBastionCryptoTransfer, executeAsyncBastionCryptoTransfer } = require("../main/bastionTransfer")
const { createBastionSandboxCryptoTransfer } = require("../main/bastionTransfeSandboxUSDHIFI")
const { createCircleCryptoTransfer, executeAsyncCircleCryptoTransfer } = require("../main/circleTransfer")

/**
transfer information should include
userId, currency, chain, amout, recipientAddress, contractAddress, requestId, recipientUserId
*/
const cryptoToCryptoSupportedFunctions = {
    POLYGON_MAINNET: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: {
                BASTION: createBastionCryptoTransfer,
                CIRCLE: createCircleCryptoTransfer
            },
            asyncExecuteFunc: {
                BASTION: executeAsyncBastionCryptoTransfer,
                CIRCLE: executeAsyncCircleCryptoTransfer
            }
        }
    },
    ETHEREUM_MAINNET: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: {
                BASTION: createBastionCryptoTransfer,
                CIRCLE: createCircleCryptoTransfer
            },
            asyncExecuteFunc: {
                BASTION: executeAsyncBastionCryptoTransfer,
                CIRCLE: executeAsyncCircleCryptoTransfer
            }
        },
        usdt: {
            walletProviderTable: "bastion_wallets",
            transferFunc: {
                BASTION: createBastionCryptoTransfer,
                CIRCLE: createCircleCryptoTransfer
            },
            asyncExecuteFunc: {
                BASTION: executeAsyncBastionCryptoTransfer,
                CIRCLE: executeAsyncCircleCryptoTransfer
            }
        }
    },
    POLYGON_AMOY: {
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: {
                BASTION: createBastionCryptoTransfer,
                CIRCLE: createCircleCryptoTransfer
            },
            asyncExecuteFunc: {
                BASTION: executeAsyncBastionCryptoTransfer,
                CIRCLE: executeAsyncCircleCryptoTransfer
            }
        },
        usdHifi: {
            walletProviderTable: "bastion_wallets",
            transferFunc: {
                BASTION: createBastionSandboxCryptoTransfer,
                CIRCLE: null
            }
        }
    },
    ETHEREUM_TESTNET:{
        usdc: {
            walletProviderTable: "bastion_wallets",
            transferFunc: {
                BASTION: createBastionCryptoTransfer,
                CIRCLE: createCircleCryptoTransfer
            },
            asyncExecuteFunc: {
                BASTION: executeAsyncBastionCryptoTransfer,
                CIRCLE: executeAsyncCircleCryptoTransfer
            }
        },
        usdHifi: {
            walletProviderTable: "bastion_wallets",
            transferFunc: {
                BASTION: createBastionSandboxCryptoTransfer,
                CIRCLE: null
            }
        }
    }
}

module.exports = cryptoToCryptoSupportedFunctions