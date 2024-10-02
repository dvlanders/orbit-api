const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")
const { getFee } = require("../feeRateMap")
const { deductBalance, getBalance, checkBalanceDeductChangeExists } = require("../balance/balanceService")
const { updateTransactionFeeRecord, getOptimisticAvailableBalance, insertTransactionFeeRecord } = require("./feeTransactionService")
const { BillingModelType } = require("../utils")
const { getProfileBillingInfo } = require("../billingInfoService")
const { transferType } = require("../../transfer/utils/transfer")
const { FeeTransactionStatus } = require("./utils")
const createLog = require("../../logger/supabaseLogger")
const { sendSlackTransferBalanceAlert } = require("../../logger/slackLogger")

const getTransactionRecord = async (transactionId, transactionType) => {

    if(transactionType === transferType.FIAT_TO_CRYPTO){
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabaseCall(() => supabase
            .from("onramp_transactions")
            .select("fiat_provider, crypto_provider, currency:source_currency, fee_currency:destination_currency, amount, user_id, profile: user_id(profile_id), status")
            .eq("id", transactionId)
            .single());

        if(fiatToCryptoError) throw fiatToCryptoError;
        return fiatToCrypto;
    }else if(transactionType === transferType.CRYPTO_TO_FIAT){
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabaseCall(() => supabase
            .from("offramp_transactions")
            .select("fiat_provider, crypto_provider, currency:destination_currency, fee_currency:source_currency, amount, user_id, profile: user_id(profile_id), status: transaction_status")
            .eq("id", transactionId)
            .single());

        if(cryptoToFiatError) throw cryptoToFiatError;
        return cryptoToFiat;
    }else if(transactionType === transferType.CRYPTO_TO_CRYPTO){
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabaseCall(() => supabase
            .from("crypto_to_crypto")
            .select("amount, user_id: sender_user_id, profile: sender_user_id(profile_id), status, fee_currency:currency")
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
        if(process.env.NODE_ENV === "development") return;
        const transactionRecord = await getTransactionRecord(transactionId, transactionType);

        // don't charge transaction fees for transactions that are not completed
        if(transactionRecord.status != "COMPLETED" && transactionRecord.status != "CONFIRMED") return;

        const billingInfo = await getProfileBillingInfo(transactionRecord.profile.profile_id);
        if(!billingInfo || billingInfo.billing_model !== BillingModelType.BALANCE) throw new Error("Billing info not found or is not BALANCE model");
        const billableDepositFee = await getTransactionFee(transactionRecord, transactionType, billingInfo);
        const balanceRecord = await getBalance(billingInfo.profile_id);
        if(!balanceRecord) throw new Error("Balance record not found");

        const toUpdate = {
            user_id: transactionRecord.user_id,
            currency: transactionRecord.fee_currency,
            amount: billableDepositFee,
            status: FeeTransactionStatus.IN_PROGRESS
        }

        const feeRecord = await updateTransactionFeeRecord(transactionId, toUpdate);

        if(feeRecord.amount > 0){
            await deductBalance(billingInfo.profile_id, feeRecord.id, feeRecord.amount);
        }
        
        // await updateTransactionFeeRecord(transactionId, {status: FeeTransactionStatus.COMPLETED});

    }catch(error){
        await updateTransactionFeeRecord(transactionId, {status: FeeTransactionStatus.FAILED});
        await createLog("chargeTransactionFee", null, `Failed to charge transaction fee for transaction: ${transactionId} with type: ${transactionType}`, error);
    }
}

const createTransactionFeeRecord = async (transactionId, transactionType) => {
    if(process.env.NODE_ENV === "development") return;
    const transactionRecord = await getTransactionRecord(transactionId, transactionType);
    const billingInfo = await getProfileBillingInfo(transactionRecord.profile.profile_id);
    if(!billingInfo) return;
    const billableDepositFee = await getTransactionFee(transactionRecord, transactionType, billingInfo);

    const toInsert = {
        transaction_id: transactionId,
        transaction_type: transactionType,
        user_id: transactionRecord.user_id,
        currency: transactionRecord.fee_currency,
        amount: billableDepositFee,
        status: FeeTransactionStatus.IN_PROGRESS
    }
    await insertTransactionFeeRecord(toInsert);
}


const checkBalanceForTransactionFee = async (transactionId, transactionType) => {

    try{
        // TODO: Uncomment below line prior to merging
        if(process.env.NODE_ENV === "development") return true;
        const transactionRecord = await getTransactionRecord(transactionId, transactionType);
        const billingInfo = await getProfileBillingInfo(transactionRecord.profile.profile_id);
        if(!billingInfo) return true; // if the customer doesn't have a billing info, it automatically means they have enough balance
        const billableDepositFee = await getTransactionFee(transactionRecord, transactionType, billingInfo);

        const balanceInfo = await getOptimisticAvailableBalance(billingInfo.profile_id);
        const availableBalance = balanceInfo.available_balance;
        const inProgressFeeTotal = balanceInfo.in_progress_fee_total;

        const hasEnoughBalance = billableDepositFee <= availableBalance;

        const toUpdate = {
            user_id: transactionRecord.user_id,
            currency: transactionRecord.fee_currency,
            amount: billableDepositFee,
            status: FeeTransactionStatus.IN_PROGRESS
        }
        const feeRecord = await updateTransactionFeeRecord(transactionId, toUpdate);

        if(billingInfo.billing_model !== BillingModelType.BALANCE) return true;
        
        if(hasEnoughBalance && billableDepositFee > (availableBalance - inProgressFeeTotal)){
            await sendSlackTransferBalanceAlert(billingInfo.profile_id, feeRecord.id, availableBalance, inProgressFeeTotal);
        }

        return hasEnoughBalance;
    }catch(error){
        await createLog("checkBalanceForTransactionFee", null, `Failed to check if user has enough balance for transaction fee for transaction: ${transactionId} with type: ${transactionType}`, error);
        throw error;
    }

}

const syncTransactionFeeRecordStatus = async (transactionId, transactionType, feeId) => {

    try{
        const transactionRecord = await getTransactionRecord(transactionId, transactionType);

        const voidStatuses = ["REFUNDED", "FAILED", "CANCELLED", "NOT_INITIATED"];
        const statusContainsVoidStatus = (status) => {
            return voidStatuses.some(voidStatus => status.includes(voidStatus));
        };

        const transactionFailed = (transactionRecord.status && statusContainsVoidStatus(transactionRecord.status)) 
            || (transactionRecord.transaction_status && statusContainsVoidStatus(transactionRecord.transaction_status));

        if (transactionFailed || process.env.NODE_ENV === "development") {
            await updateTransactionFeeRecord(transactionId, { status: FeeTransactionStatus.VOIDED });
        }

        if(await checkBalanceDeductChangeExists(feeId)){
            await updateTransactionFeeRecord(transactionId, { status: FeeTransactionStatus.COMPLETED });
        }

    }catch(error){
        console.log(error)
        await createLog("syncTransactionFeeRecordStatus", null, `Failed to sync transaction fee record status for transaction: ${transactionId} with type: ${transactionType}`, error);
    }

}

module.exports = {
    chargeTransactionFee,
    checkBalanceForTransactionFee,
    syncTransactionFeeRecordStatus,
    createTransactionFeeRecord
}