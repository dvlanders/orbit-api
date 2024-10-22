const createLog = require("../../logger/supabaseLogger")
const { transferType } = require("./transfer")

const BillingTagsForOfframp = { 
        ach:{
            usd:{
                success: ["base", "ach"],
                failed: ["ach_return"],
            }
        },
        sepa:{
            eur:{
                success: ["base", "sepa"],
                failed: [],
            },
        },
        wire:{
            usd:{
                success: ["base", "wire_domestic"],
                failed: ["wire_return"],
            }
        },
        swift:{
            usd:{
                success: ["base", "swift"],
                failed: ["wire_return"],
            }
        },
        pix:{
            brl:{
                success: ["base"],
                failed: [],
            }
        },
        spei:{
            mxn:{
                success: ["base"],
                failed: [],
            },
        },
        ach_cop:{
            cop:{
                success: ["base"],
                failed: [],
            },
        },
        momo_transfer: {
            kes:{
                success: ["base"],  
                failed: [],
            },
            xof:{
                success: ["base"],  
                failed: [],
            },
            rwf:{
                success: ["base"],  
                failed: [],
            },
            zmw:{
                success: ["base"],  
                failed: [],
            },
        },
        bank_transfer: {
            ngn:{
                success: ["base"],  
                failed: [],
            },
            ugx:{
                success: ["base"],  
                failed: [],
            },
            TZS:{
                success: ["base"],  
                failed: [],
            },
            MWK:{
                success: ["base"],  
                failed: [],
            },
            XAF:{
                success: ["base"],  
                failed: [],
            },
        },
        fps:{
            hkd:{
                success: ["base"],
                failed: [],
            }
        }
}

const BillingTagsForOnramp = {
    ach:{
        usd:{
            success: ["base"],
            failed: [],
        }
    }
}


const getBillingTagsFromAccount = async(requestId, transactionType, userId, accountInfo) => {
    try{
        if (transactionType === transferType.CRYPTO_TO_FIAT){
            return BillingTagsForOfframp[accountInfo.payment_rail][accountInfo.currency]
        }else if (transactionType === transferType.FIAT_TO_CRYPTO){
            return BillingTagsForOnramp[accountInfo.payment_rail][accountInfo.currency]
        }

    }catch(error){
        await createLog("transfer/utils/getBillingTags", userId, error.message, {error: `${transactionType}: failed to grab billing tags from account ${accountInfo.id} for requestId ${requestId}`})
        return {
            success: ["base"],
            failed: [],
        }
    }

}

module.exports = {
    getBillingTagsFromAccount
}