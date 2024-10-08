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
                BASTION:{
                    transferFunc: createBastionCryptoTransfer,
                    asyncExecuteFunc: executeAsyncBastionCryptoTransfer
                },
                CIRCLE:{
                    transferFunc: createCircleCryptoTransfer,
                    asyncExecuteFunc: executeAsyncCircleCryptoTransfer
                }
            }
    },
    ETHEREUM_MAINNET: {
        usdc: {
            BASTION:{
                transferFunc: createBastionCryptoTransfer,
                asyncExecuteFunc: executeAsyncBastionCryptoTransfer
            },
            CIRCLE:{
                transferFunc: createCircleCryptoTransfer,
                asyncExecuteFunc: executeAsyncCircleCryptoTransfer
            }
        },
        usdt: {
            BASTION:{
                transferFunc: createBastionCryptoTransfer,
                asyncExecuteFunc: executeAsyncBastionCryptoTransfer
            },
            CIRCLE:{
                transferFunc: createCircleCryptoTransfer,
                asyncExecuteFunc: executeAsyncCircleCryptoTransfer
            }
        },
    },
    POLYGON_AMOY: {
        usdc: {
            BASTION:{
                transferFunc: createBastionCryptoTransfer,
                asyncExecuteFunc: executeAsyncBastionCryptoTransfer
            },
            CIRCLE:{
                transferFunc: createCircleCryptoTransfer,
                asyncExecuteFunc: executeAsyncCircleCryptoTransfer
            }
        },
        usdHifi: {
            BASTION:{
                transferFunc: createBastionSandboxCryptoTransfer
            },
            CIRCLE: {
                transferFunc: createBastionSandboxCryptoTransfer
            }
        }
    },
    ETHEREUM_TESTNET:{
        usdc: {
            BASTION:{
                transferFunc: createBastionCryptoTransfer,
                asyncExecuteFunc: executeAsyncBastionCryptoTransfer
            },
            CIRCLE:{
                transferFunc: createCircleCryptoTransfer,
                asyncExecuteFunc: executeAsyncCircleCryptoTransfer
            }
        },
        usdHifi: {
            BASTION:{
                transferFunc: createBastionSandboxCryptoTransfer
            },
            CIRCLE: {
                transferFunc: createBastionSandboxCryptoTransfer
            }
        }
    }
}

module.exports = cryptoToCryptoSupportedFunctions