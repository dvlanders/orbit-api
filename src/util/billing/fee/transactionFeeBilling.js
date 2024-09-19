const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")
const { getFee } = require("../feeRateMap")
const { deductBalance, isBalanceChangeApplied, getBalance } = require("../balance/balanceService")
const { updateTransactionFeeRecord } = require("./feeTransactionService")
const { getProfileBillingInfo } = require("../billingInfoService")
const { transferType } = require("../../transfer/utils/transfer")
const createLog = require("../../logger/supabaseLogger")

const getTransactionRecord = async (transactionId, transactionType) => {

    if(transactionType === transferType.FIAT_TO_CRYPTO){
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabaseCall(() => supabase
            .from("onramp_transactions")
            .select("fiat_provider, crypto_provider, currency:source_currency, amount, user_id, profile: user_id(profile_id), status")
            .eq("id", transactionId)
            .single());

        if(fiatToCryptoError) throw fiatToCryptoError;
        return fiatToCrypto;
    }else if(transactionType === transferType.CRYPTO_TO_FIAT){
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabaseCall(() => supabase
            .from("offramp_transactions")
            .select("fiat_provider, crypto_provider, currency:destination_currency, amount, user_id, profile: user_id(profile_id), status: transaction_status")
            .eq("id", transactionId)
            .single());

        if(cryptoToFiatError) throw cryptoToFiatError;
        return cryptoToFiat;
    }else if(transactionType === transferType.CRYPTO_TO_CRYPTO){
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabaseCall(() => supabase
            .from("crypto_to_crypto")
            .select("amount, user_id: sender_user_id, profile: sender_user_id(profile_id), status")
            .eq("id", transactionId)
            .single());

        if(cryptoToCryptoError) throw cryptoToCryptoError;
        return cryptoToCrypto;

    }else{
        throw new Error("Invalid transaction id or transaction type");
    }

}

const getTransactionFee = async (transactionRecord, transactionType, billingInfo) => {

    let totalFee = 0;
    if(transactionType === transferType.CRYPTO_TO_CRYPTO){
        totalFee = transactionRecord.amount * billingInfo.crypto_payout_fee_percent;
    }else if(transactionType === transferType.FIAT_TO_CRYPTO){
        totalFee = getFee(transactionRecord, billingInfo.fiat_deposit_config);
    }else if(transactionType === transferType.CRYPTO_TO_FIAT){
        totalFee = getFee(transactionRecord, billingInfo.fiat_payout_config);
    }

    return parseFloat(totalFee.toFixed(2));
}

const chargeTransactionFee = async (transactionId, transactionType) => {

    try{
        const transactionRecord = await getTransactionRecord(transactionId, transactionType);

        // don't charge transaction fees for transactions that are not completed
        if(transactionRecord.status != "COMPLETED" && transactionRecord.status != "CONFIRMED") return;

        const billingInfo = await getProfileBillingInfo(transactionRecord.profile.profile_id);
        if(!billingInfo) return; // if the customer doesn't have a billing info, just pass
        const billableDepositFee = await getTransactionFee(transactionRecord, transactionType, billingInfo);

        const toUpdate = {
            user_id: transactionRecord.user_id,
            currency: transactionRecord.currency,
            amount: billableDepositFee,
            status: "IN_PROGRESS"
        }

        // don't charge the customer transaction fees in sandbox
        //TODO: remove this comment below
        // if(process.env.NODE_ENV === "development"){
        //     toUpdate.amount = 0;
        // }
        const feeRecord = await updateTransactionFeeRecord(transactionId, toUpdate);

        // prevent double charging
        if(!await isBalanceChangeApplied(feeRecord.id)){
            await deductBalance(billingInfo.profile_id, feeRecord.id, feeRecord.amount);
        }
        
        await updateTransactionFeeRecord(transactionId, {status: "COMPLETED"});

    }catch(error){
        await updateTransactionFeeRecord(transactionId, {status: "FAILED"});
        await createLog("chargeTransactionFee", null, `Failed to charge transaction fee for transaction: ${transactionId} with type: ${transactionType}`, error);
    }
}


const hasEnoughBalanceForTransactionFee = async (transactionId, transactionType) => {

    try{
        const transactionRecord = await getTransactionRecord(transactionId, transactionType);
        const billingInfo = await getProfileBillingInfo(transactionRecord.profile.profile_id);
        if(!billingInfo) return true; // if the customer doesn't have a billing info, it automatically means they have enough balance
        const billableDepositFee = await getTransactionFee(transactionRecord, transactionType, billingInfo);

        const balanceRecord = await getBalance(billingInfo.profile_id);
        if(!balanceRecord) return true; // if the customer doesn't have a balance record, it automatically means they have enough balance
        
        return billableDepositFee <= balanceRecord.balance;
    }catch(error){
        await createLog("hasEnoughBalanceForTransactionFee", null, `Failed to check if user has enough balance for transaction fee for transaction: ${transactionId} with type: ${transactionType}`, error);
        throw error;
    }

}

const syncTransactionFeeRecordStatus = async (transactionId, transactionType) => {

    try{
        const transactionRecord = await getTransactionRecord(transactionId, transactionType);

        const voidStatuses = ["REFUNDED", "FAILED", "CANCELED"];
        const statusContainsVoidStatus = (status) => {
            return voidStatuses.some(voidStatus => status.includes(voidStatus));
        };

        const transactionFailed = (transactionRecord.status && statusContainsVoidStatus(transactionRecord.status)) 
            || (transactionRecord.transaction_status && statusContainsVoidStatus(transactionRecord.transaction_status));

        if (transactionFailed) {
            await updateTransactionFeeRecord(transactionId, { status: "VOIDED" });
        }

    }catch(error){
        console.log(error)
        await createLog("syncTransactionFeeRecordStatus", null, `Failed to sync transaction fee record status for transaction: ${transactionId} with type: ${transactionType}`, error);
    }

}

module.exports = {
    chargeTransactionFee,
    hasEnoughBalanceForTransactionFee,
    syncTransactionFeeRecordStatus
}