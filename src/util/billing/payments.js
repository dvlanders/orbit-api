const { getProfileBillingInfo } = require('./billingInfoService');
const stripe = require('stripe')(process.env.STRIPE_SK_KEY);
const { getProductId } = require('../stripe/stripeService');

// charge the autopay amount with the customer's default payment method
const autopay = async (profileId) => {

    const billingInfo = await getProfileBillingInfo(profileId);
    if(!billingInfo || !billingInfo.stripe_customer_id || !billingInfo.stripe_default_payment_method_id) throw new Error("Billing info not found for autopay");
    if(!billingInfo.autopay) throw new Error("Autopay not enabled for this profile");

    const autopayCentAmount = billingInfo.autopay_amount * 100;
    
    const invoice = await stripe.invoices.create({
      customer: billingInfo.stripe_customer_id,
      collection_method: 'charge_automatically',
      default_payment_method: billingInfo.stripe_default_payment_method_id,
      metadata: {
        type: "fund",
        profileId: profileId,
        credit: billingInfo.autopay_amount
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
    console.log(invoicePay);

}

// charge the account minimum with the customer's default payment method
const accountMinimumPay = async (profileId) => {

  const billingInfo = await getProfileBillingInfo(profileId);
  if(!billingInfo || !billingInfo.stripe_customer_id || !billingInfo.stripe_default_payment_method_id) throw new Error("Billing info not found for accountMinimumPay");
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: billingInfo.monthly_minimum * 100,
    currency: 'usd',
    customer: billingInfo.stripe_customer_id,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never"
    },
    payment_method: billingInfo.stripe_default_payment_method_id,
    metadata: {
      type: "account_minimum",
      profileId: profileId,
      credit: billingInfo.monthly_minimum
    },
    confirm: true
  });

  console.log(paymentIntent);

}

module.exports = {
  autopay,
  accountMinimumPay
};
  