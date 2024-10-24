const { getProfileBillingInfo } = require('./billingInfoService');
const { BalanceTopupType, generateHIFICreditId, BalanceTopupStatus } = require('./balance/utils');
const { insertBalanceTopupRecord, updateBalanceTopupRecord, getBalance } = require('./balance/balanceService');
const { aquireAutopayLock, releaseAutopayLock } = require('./lockService');
const stripe = require('stripe')(process.env.STRIPE_SK_KEY);
const { getProductId } = require('../stripe/stripeService');
const createLog = require('../logger/supabaseLogger');

// charge the autopay amount with the customer's default payment method
const autopay = async (profileId, balanceId, amount = 0) => {
    console.log("autopay", profileId, amount);
    const billingInfo = await getProfileBillingInfo(profileId);
    if(!billingInfo || !billingInfo.stripe_customer_id || !billingInfo.stripe_default_payment_method_id) throw new Error("Billing info not found for autopay");
    if(!billingInfo.autopay) throw new Error("Autopay not enabled for this profile");

    if(!await aquireAutopayLock(profileId)){
      console.log("Failed to aquire autopay lock for profile", profileId)
      return;
    }

    const toInsert = {
      profile_id: profileId,
      balance_id: balanceId,
      amount: amount,
      status: BalanceTopupStatus.CREATED,
      type: BalanceTopupType.AUTOPAY,
      hifi_credit_id: generateHIFICreditId()
    }

    const topupRecord = await insertBalanceTopupRecord(toInsert);

    try{
      const autopayDollarAmount = amount > 0 ? amount : billingInfo.autopay_amount;
      const autopayCentAmount = autopayDollarAmount * 100;

      const invoice = await stripe.invoices.create({
        customer: billingInfo.stripe_customer_id,
        collection_method: 'charge_automatically',
        default_payment_method: billingInfo.stripe_default_payment_method_id,
        metadata: {
          type: BalanceTopupType.AUTOPAY,
          profileId: profileId,
          topupRecordId: topupRecord.id,
          credit: autopayDollarAmount
        }
      });

      const productId = await getProductId("Fund");

      const invoiceItem = await stripe.invoiceItems.create({
        customer: billingInfo.stripe_customer_id,
        price_data: {
          currency: "usd",
          product: productId.product_id,
          unit_amount: autopayCentAmount
        },
        invoice: invoice.id
      });

      const invoicePay = await stripe.invoices.pay(invoice.id);

      await updateBalanceTopupRecord(topupRecord.id, {stripe_invoice_id: invoicePay.id, status: BalanceTopupStatus.PENDING});
  
    }catch(error){
      console.log(error);
      await updateBalanceTopupRecord(topupRecord.id, {status: BalanceTopupStatus.FAILED});
      await releaseAutopayLock(profileId);
      return await createLog("autopay", null, `Failed to charge autopay for profile: ${profileId}`, error);
    }

}

// charge the account minimum with the customer's default payment method
const accountMinimumPay = async (profileId) => {

    const billingInfo = await getProfileBillingInfo(profileId);
    if(!billingInfo || !billingInfo.stripe_customer_id || !billingInfo.stripe_default_payment_method_id) throw new Error("Billing info not found for accountMinimumPay");
    const balanceRecord = await getBalance(profileId);
    if(!balanceRecord) throw new Error("Balance record not found for accountMinimumPay");
    
    const toInsert = {
      profile_id: profileId,
      balance_id: balanceRecord.id,
      amount: billingInfo.monthly_minimum,
      status: BalanceTopupStatus.CREATED,
      type: BalanceTopupType.ACCOUNT_MINIMUM,
      hifi_credit_id: generateHIFICreditId()
    }

    const topupRecord = await insertBalanceTopupRecord(toInsert);
    try{

      const invoice = await stripe.invoices.create({
        customer: billingInfo.stripe_customer_id,
        collection_method: 'charge_automatically',
        default_payment_method: billingInfo.stripe_default_payment_method_id,
        metadata: {
          type: BalanceTopupType.ACCOUNT_MINIMUM,
          profileId: profileId,
          topupRecordId: topupRecord.id,
          credit: billingInfo.monthly_minimum
        }
      });

      const productId = await getProductId("account_minimum");

      const invoiceItem = await stripe.invoiceItems.create({
        customer: billingInfo.stripe_customer_id,
        price_data: {
          currency: "usd",
          product: productId.product_id,
          unit_amount: billingInfo.monthly_minimum * 100
        },
        invoice: invoice.id
      });

      const invoicePay = await stripe.invoices.pay(invoice.id);
      await updateBalanceTopupRecord(topupRecord.id, {stripe_invoice_id: invoicePay.id, status: BalanceTopupStatus.PENDING});
  }catch(error){
    console.log(error);
    await updateBalanceTopupRecord(topupRecord.id, {status: BalanceTopupStatus.FAILED});
    return await createLog("accountMinimumPay", null, `Failed to charge account minimum for profile: ${profileId}`, error);
  }

}

module.exports = {
  autopay,
  accountMinimumPay
};
  