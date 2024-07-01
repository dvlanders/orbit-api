const transferToBridgeLiquidationAddress = require("../transfer/transferToBridgeLiquidationAddress");

// const CryptoToBankSupportedPairFunctions = {
//     "usdc-usd": {
//         "ach":{
//             transferFunc: transferToBridgeLiquidationAddress,
//         },
//         "wire":{
//             transferFunc: null,
//         }
//     }, 
//     "usdc-eur":{
//         "sepa":{
//             transferFunc: transferToBridgeLiquidationAddress,
//         },
//         "wire":{
//             transferFunc: null,
//         }
//     },
//     "usdt-usd":{
//         "wire":{
//             transferFunc: null,
//         }
//     }
// }

const CryptoToBankSupportedPairCheck = (paymentRail, sourceCurrency, destinationCurrency) => {
    try {
        return CryptoToBankSupportedPairFunctions[paymentRail][sourceCurrency][destinationCurrency]
    }catch (error){
        return null
    }
}

const CryptoToBankSupportedPairFunctions = {
    wire:{
        
    },
    ach:{
        usdc:{
            usd: {
                transferFunc: transferToBridgeLiquidationAddress,
            },
        }
    },
    sepa:{
        usdc:{
            eur:{
                transferFunc: transferToBridgeLiquidationAddress,
            },
        }
    }
}

module.exports = CryptoToBankSupportedPairCheck