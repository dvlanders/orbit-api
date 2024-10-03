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
        spei_bitso:{
            mxn:{
                success: ["base"],
                failed: [],
            },
        },
        ach_cop_bitso:{
            cop:{
                success: ["base"],
                failed: [],
            },
        },
        momo_mpesa:{
            kes:{
                success: ["base"],  
                failed: [],
            },
        },
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
            return BillingTagsForOfframp[accountInfo.rail_type][accountInfo.currency]
        }else if (transactionType === transferType.FIAT_TO_CRYPTO){
            return BillingTagsForOnramp[accountInfo.rail_type][accountInfo.currency]
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