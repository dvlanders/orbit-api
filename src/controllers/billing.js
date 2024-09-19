const createLog = require("../util/logger/supabaseLogger");
const { fieldsValidation } = require("../util/common/fieldsValidation");
const { updateProfileBillingInfo, getProfileBillingInfo } = require("../util/billing/billingInfoService");
const { isValidAmount, isInRange } = require("../util/common/filedValidationCheckFunctions");
const { getProductId } = require("../util/stripe/stripeService");
const supabase = require("../util/supabaseClient");
const { convertKeysToCamelCase } = require("../util/utils/object");
const stripe = require("stripe")(process.env.STRIPE_SK_KEY);

exports.createSetupIntent = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { profileId } = req.query;

  try {
    const billingInfo = await getProfileBillingInfo(profileId);
    if (!billingInfo) return res.status(400).json({ error: `Billing info for profile id (${profileId}) not found. You need to add billing info first before adding a payment.`});
    if (!billingInfo.stripe_customer_id) return res.status(500).json({ error: `Billing info for profile id (${profileId}) somehow doesn't have Stripe customer id. Please contact support.`});

    const setupIntent = await stripe.setupIntents.create({
      customer: billingInfo.stripe_customer_id,
      payment_method_types: ["card", "us_bank_account"],
      payment_method_options: {
        us_bank_account: {
          verification_method: "automatic",
        },
      },
      metadata: {
        type: "onboard",
        profileId: profileId,
      },
    });

    return res.status(200).json({
      message: `You have created a setup intent for profile id (${profileId})`,
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    await createLog("createSetupIntent", null, error.message, error, profileId);
    return res.status(500).json({ error: "Unexpected error happened" });
  }
};

exports.setUpAutoPay = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { profileId } = req.query;

  //set to default if don't allow autopay
  if (req.body.allow === false) {
    req.body.amount = 10;
    req.body.threshold = 0.8;
  }

  const { allow, amount, threshold } = req.body;

  try {
    const requiredFields = ["allow", "amount", "threshold"];
    const acceptedFields = {
      allow: "boolean",
      amount: (value) => isValidAmount(value, 10),
      threshold: (value) => isInRange(value, 0, 1),
    };
    const { missingFields, invalidFields } = fieldsValidation(req.body, requiredFields, acceptedFields);
    if (missingFields.length > 0 || invalidFields.length > 0)
      return res.status(400).json({ 
        error: `fields provided are either missing or invalid`,
        missingFields: missingFields,
        invalidFields: invalidFields,
      });

    const billingInfo = await getProfileBillingInfo(profileId);
    if (!billingInfo)
      return res.status(400).json({
        error: `Billing info for profile id (${profileId}) not found. You need to add billing info first before adding a payment.`,
      });

    const updatedBillingInfo = await updateProfileBillingInfo(profileId, {
      autopay: allow,
      autopay_amount: amount,
      autopay_threshold: threshold,
    });

    return res.status(200).json({
      message: `You have successfully updated autopay config for profile id (${profileId})`,
      autopay: updatedBillingInfo.autopay,
      autopay_amount: updatedBillingInfo.autopay_amount,
      autopay_threshold: updatedBillingInfo.autopay_threshold,
    });
  } catch (error) {
    await createLog("setUpAutoPay", null, error.message, error, profileId);
    return res.status(500).json({ error: "Unexpected error happened" });
  }
};

exports.createCheckoutSession = async (req, res) => {
  const { profileId } = req.query;
  const { amount } = req.body;
  try {
    const requiredFields = ["amount"];
    const acceptedFields = { amount: (value) => isValidAmount(value) };
    const { missingFields, invalidFields } = fieldsValidation(req.body, requiredFields, acceptedFields);
    if (missingFields.length > 0 || invalidFields.length > 0)
      return res.status(400).json({
        error: `fields provided are either missing or invalid`,
        missingFields: missingFields,
        invalidFields: invalidFields,
      });

    const billingInfo = await getProfileBillingInfo(profileId);
    if (!billingInfo)
      return res.status(400).json({
        error: `Billing info for profile id (${profileId}) not found. You need to add billing info first before adding a payment.`,
      });
    if (!billingInfo.stripe_customer_id)
      return res.status(500).json({
        error: `Billing info for profile id (${profileId}) somehow doesn't have Stripe customer id. Please contact support.`,
      });

    const productId = await getProductId("Fund");

    const session = await stripe.checkout.sessions.create({
      customer: billingInfo.stripe_customer_id,
      payment_method_types: ["card", "us_bank_account"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product: productId.product_id,
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded",
      redirect_on_completion: "never",
      invoice_creation: {
        enabled: true,
        invoice_data: {
          metadata: {
          type: "fund",
          profileId: profileId,
          credit: amount,
        },
        }
      }
    });

    return res.status(200).json({
      message: `You have created a checkout session for profile id (${profileId})`,
      clientSecret: session.client_secret,
    });
  } catch (error) {
    await createLog("createCheckoutSession", null, error.message, error, profileId);
    return res.status(500).json({ error: "Unexpected error happened" });
  }
};

exports.getCreditBalance = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });
	const { profileId } = req.query
	try{
		const {data: balance, error: balanceError} = await supabase
        .from("balance")
        .select("updated_at, balance, monthly_minimum: billing_info_id(monthly_minimum)")
        .eq("profile_id", profileId)
        .single()
    
		if (balanceError) throw balanceError
		const _balance = {
			...balance,
			monthly_minimum: balance.monthly_minimum.monthly_minimum
		}
     	
		return res.status(200).json({creditBalance: convertKeysToCamelCase(_balance)})

	}catch (error){
		await createLog("dashboard/utils/getCreditBalance", null, error.message, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}
