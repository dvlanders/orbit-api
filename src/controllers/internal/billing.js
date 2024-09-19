const { isUUID, fieldsValidation, isValidISODateFormat } = require("../../util/common/fieldsValidation");
const { addBillingInfo, updateProfileBillingInfo } = require("../../util/billing/billingInfoService");
const { isValidEmail, isValidAmount } = require("../../util/common/filedValidationCheckFunctions");
const supabase = require("../../util/supabaseClient");
const stripe = require('stripe')(process.env.STRIPE_SK_KEY);

exports.addBilling = async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    
    const { profileId } = req.query;
    const fields = req.body;
    const { email, name, cryptoPayoutFeePercent, monthlyMinimum, activeVirtualAccountFee, fiatPayoutConfig, fiatDepositConfig, periodStart, periodEnd, platformFee, integrationFee } = fields;
  
    try {

      if(!isUUID(profileId)) return res.status(400).json({error: `profile id (${profileId}) is invalid`});

      const requiredFields = ["email", "name", "cryptoPayoutFeePercent", "monthlyMinimum", "activeVirtualAccountFee", "fiatPayoutConfig", "fiatDepositConfig", "periodStart", "periodEnd", "platformFee", "integrationFee"];
      const acceptedFields = {
        email: (value) => isValidEmail(value),
        name: "string",
        cryptoPayoutFeePercent: (value) => isValidAmount(value),
        monthlyMinimum: (value) => isValidAmount(value),
        activeVirtualAccountFee: (value) => isValidAmount(value),
        fiatPayoutConfig: "object",
        fiatDepositConfig: "object",
        periodStart: (value) => isValidISODateFormat(value),
        periodEnd: (value) => isValidISODateFormat(value),
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
  
      const toInsert = {
        profile_id: profileId,
        crypto_payout_fee_percent: cryptoPayoutFeePercent,
        monthly_minimum: monthlyMinimum,
        active_virtual_account_fee: activeVirtualAccountFee,
        fiat_payout_config: fiatPayoutConfig,
        fiat_deposit_config: fiatDepositConfig,
        billing_email: email,
        billing_name: name,
        next_billing_period_start: new Date(periodStart).toISOString(),
        next_billing_period_end: new Date(periodEnd).toISOString(),
        billable: true,
        platform_fee: platformFee,
        integration_fee: integrationFee
      }
  
      const billingInfo = await addBillingInfo(toInsert);
  
      if(!billingInfo) return res.status(500).json({error: `There exists a billing info for profile id (${profileId}) already.`});
  
      const customerInfo = {
        name, 
        email, 
        metadata: {
          profileId
        }
      }
  
      const customer = await stripe.customers.create(customerInfo);
  
      const updatedBillingInfo = await updateProfileBillingInfo(profileId, { stripe_customer_id: customer.id });
      
      // update profile, flip billing enabled to true
      const {data: profile, error: profileError} = await supabase
        .from("profiles")
        .update({
          billing_enabled: true
        })
        .eq("id", profileId)
        .single()
      
      if (profileError) throw profileError


      return res.status(200).json({
        message: `You have successfully added bill for profile id (${profileId})`, ...updatedBillingInfo,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Unexpected error happened" });
    }
  };
