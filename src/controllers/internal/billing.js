const {
    isUUID,
    fieldsValidation,
    isValidISODateFormat
  } = require("../../util/common/fieldsValidation");
const { addBillingInfo, updateBillingInfo, getBillingInfo } = require("../../util/billing/billingInfoService");
const { isValidEmail, isValidAmount } = require("../../util/common/filedValidationCheckFunctions");
const stripe = require('stripe')(process.env.STRIPE_TEST_SK_KEY);

exports.addBilling = async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
  
    const fields = req.body;
    const { pid, email, name, cryptoPayoutFeePercent, monthlyMinimum, activeVirtualAccountFee, fiatPayoutConfig, fiatDepositConfig, periodStart, platformFee, integrationFee } = fields;
  
    try {
      const requiredFields = ["pid", "email", "name", "cryptoPayoutFeePercent", "monthlyMinimum", "activeVirtualAccountFee", "fiatPayoutConfig", "fiatDepositConfig", "periodStart", "platformFee", "integrationFee"];
      const acceptedFields = {
        pid: (value) => isUUID(value),
        email: (value) => isValidEmail(value),
        name: "string",
        cryptoPayoutFeePercent: (value) => isValidAmount(value),
        monthlyMinimum: (value) => isValidAmount(value),
        activeVirtualAccountFee: (value) => isValidAmount(value),
        fiatPayoutConfig: "object",
        fiatDepositConfig: "object",
        periodStart: (value) => isValidISODateFormat(value),
        platformFee: (value) => isValidAmount(value),
        integrationFee: (value) => isValidAmount(value),
      };
  
      const { missingFields, invalidFields } = fieldsValidation(
        fields,
        requiredFields,
        acceptedFields
      );
      if (missingFields.length > 0 || invalidFields.length > 0)
        return res.status(400).json({
          error: `fields provided are either missing or invalid`,
          missingFields: missingFields,
          invalidFields: invalidFields,
        });
  
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodStart);
      periodEndDate.setMonth(periodEndDate.getMonth() + 1);
  
      const toInsert = {
        profile_id: pid,
        crypto_payout_fee_percent: cryptoPayoutFeePercent,
        monthly_minimum: monthlyMinimum,
        active_virtual_account_fee: activeVirtualAccountFee,
        fiat_payout_config: fiatPayoutConfig,
        fiat_deposit_config: fiatDepositConfig,
        billing_email: email,
        billing_name: name,
        next_billing_period_start: periodStartDate.toISOString(),
        next_billing_period_end: periodEndDate.toISOString(),
        billable: true,
        platform_fee: platformFee,
        integration_fee: integrationFee
      }
  
      const billingInfo = await addBillingInfo(toInsert);
  
      if(!billingInfo) return res.status(500).json({error: `There exists a billing info for profile id (${pid}) already.`});
  
      const customerInfo = {
        name, email
      }
  
      const customer = await stripe.customers.create(customerInfo);
  
      const updatedBillingInfo = await updateBillingInfo(billingInfo.id, { stripe_customer_id: customer.id });
  
      return res.status(200).json({
        message: `You have successfully added bill for profile id (${pid})`, ...updatedBillingInfo,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Unexpected error happened" });
    }
  };
  
  exports.setUpPaymentMethodToBilling = async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    
    const { pid } = req.query;
  
    try {
  
      const requiredFields = ["pid"];
      const acceptedFields = {pid: (value) => isUUID(value)};
      const { missingFields, invalidFields } = fieldsValidation(req.query, requiredFields, acceptedFields);
      if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields});
  
      const billingInfo = await getBillingInfo(pid);
      if(!billingInfo) return res.status(400).json({error: `Billing info for profile id (${pid}) not found. You need to add billing info first before adding a payment.`});
      if(!billingInfo.stripe_customer_id) return res.status(500).json({error: `Billing info for profile id (${pid}) somehow doesn't have Stripe customer id. Please contact support.`});
    
      const setupIntent = await stripe.setupIntents.create({
        customer: billingInfo.stripe_customer_id,
        payment_method_types: ["card", "us_bank_account"],
        metadata: {
          billing_info_id: billingInfo.id,
        }
      });
  
      return res.status(200).json({
        message: `You have created a setup intent for profile id (${pid})`,
        clientSecret: setupIntent.client_secret
      });
    } catch (error) {
      console.log(error)
      return res.status(500).json({ error: "Unexpected error happened" });
    }
  };
  