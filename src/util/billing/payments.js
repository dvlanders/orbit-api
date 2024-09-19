const { getProfileBillingInfo } = require('./billingInfoService');
const stripe = require('stripe')(process.env.STRIPE_SK_KEY);
const { getProductId } = require('../stripe/stripeService');

const insertAutopayEvent = async (profileId, billingInfoId ) => {

  const {data, error} = await supabaseCall(() => supabase
    .from('autopay_events')
    .insert({profile_id: profileId, billing_info_id: billingInfoId, status: "IN_PROGRESS"})
    .select()
    .single());

  if(error) throw error;
  return data;
}

const updateAutopayEvent = async (id, toUpdate) => {
  
    const {error} = await supabaseCall(() => supabase
      .from('autopay_events')
      .update(toUpdate)
      .eq('id', id));
  
    if(error) throw error;

}

const updateAutopayInvoiceEvent = async (invoiceId, toUpdate) => {
  
  const {error} = await supabaseCall(() => supabase
    .from('autopay_events')
    .update(toUpdate)
    .eq('stripe_invoice_id', invoiceId));

  if(error) throw error;

}

// charge the autopay amount with the customer's default payment method
const autopay = async (profileId, amount = 0) => {

    const billingInfo = await getProfileBillingInfo(profileId);
    if(!billingInfo || !billingInfo.stripe_customer_id || !billingInfo.stripe_default_payment_method_id) throw new Error("Billing info not found for autopay");
    if(!billingInfo.autopay) throw new Error("Autopay not enabled for this profile");

    const autopayEvent = await insertAutopayEvent(profileId, billingInfo.id);

    const autopayDollarAmount = amount > 0 ? amount : billingInfo.autopay_amount;
    const autopayCentAmount = autopayDollarAmount * 100;
    
    const invoice = await stripe.invoices.create({
      customer: billingInfo.stripe_customer_id,
      collection_method: 'charge_automatically',
      default_payment_method: billingInfo.stripe_default_payment_method_id,
      metadata: {
        type: "fund",
        profileId: profileId,
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
    console.log(invoicePay);

    await updateAutopayEvent(autopayEvent.id, {stripe_invoice_id: invoicePay.id});

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
  accountMinimumPay,
  updateAutopayEvent,
  updateAutopayInvoiceEvent
};
  