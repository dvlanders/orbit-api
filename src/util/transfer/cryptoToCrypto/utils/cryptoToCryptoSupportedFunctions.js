const { createBastionSandboxCryptoTransfer } = require("../main/bastionTransfeSandboxUSDHIFI")
const { createDirectCryptoTransfer, executeAsyncDirectCryptoTransfer } = require("../main/directTransfer")

/**
transfer information should include
userId, currency, chain, amout, recipientAddress, contractAddress, requestId, recipientUserId
*/
const cryptoToCryptoSupportedFunctions = {
    POLYGON_MAINNET: {
        usdc: {
            transferFunc: createDirectCryptoTransfer,
            asyncExecuteFunc: executeAsyncDirectCryptoTransfer
        }
    },
    ETHEREUM_MAINNET: {
        usdc: {
            transferFunc: createDirectCryptoTransfer,
            asyncExecuteFunc: executeAsyncDirectCryptoTransfer
        },
        usdt: {
            transferFunc: createDirectCryptoTransfer,
            asyncExecuteFunc: executeAsyncDirectCryptoTransfer
        },
    },
    POLYGON_AMOY: {
        usdc: {
            transferFunc: createDirectCryptoTransfer,
            asyncExecuteFunc: executeAsyncDirectCryptoTransfer
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
            transferFunc: createDirectCryptoTransfer,
            asyncExecuteFunc: executeAsyncDirectCryptoTransfer
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