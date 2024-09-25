const createLog = require("../../logger/supabaseLogger");
const stripe = require('stripe')(process.env.STRIPE_SK_KEY);

const stripeSignatureVerification = async (req, res, next) => {
  try {
    let event
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
    const signature = req.headers['stripe-signature'];
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            endpointSecret
        );
    } catch (err) {
        console.log(`⚠️  Webhook signature verification failed.`, err.message);
        return res.status(400).json({error: "Failed to verify"})
    }
    req.body.event = event;
    next();
  } catch (error) {
    await createLog("middleware/stripeSignatureVerification", null, error.message, error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
    stripeSignatureVerification,
};
