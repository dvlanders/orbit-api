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
        momo_kes: {
            kes:{
                success: ["base"],  
                failed: [],
            }
        },
        momo_xof: {
            xof:{
                success: ["base"],  
                failed: [],
            }
        },
        momo_rwf: {
            rwf:{
                success: ["base"],  
                failed: [],
            }
        },
        momo_zmw: {
            zmw:{
                success: ["base"],  
                failed: [],
            },
        },
        bank_ngn: {
            ngn:{
                success: ["base"],  
                failed: [],
            }
        },
        bank_ugx: {
            ugx:{
                success: ["base"],  
                failed: [],
            }
        },
        momo_tzs: {
            tzs:{
                success: ["base"],  
                failed: [],
            }
        },
        momo_mwk: {
            mwk:{
                success: ["base"],  
                failed: [],
            }
        },
        momo_xaf: {
            xaf:{
                success: ["base"],  
                failed: [],
            }
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
    console.log(requestId, transactionType, userId, accountInfo)
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