const { updateBillStatus } = require('../util/billing/updateBillStatus');
const { updateBillingInfo } = require('../util/billing/billingInfoService');
const createLog = require('../util/logger/supabaseLogger');

const stripe = require('stripe')(process.env.STRIPE_SK_KEY);

exports.stripeWebhook = async(req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: 'Method not allowed' });
    try{
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
        
        if (event.type.split(".")[0] == "invoice"){
            // update to paid
            await updateBillStatus(event)
        }else if(event.type.split(".")[0] == "setup_intent"){
            const billingInfoId = event.data?.object?.metadata?.billing_info_id;
            const paymentMethodId = event.data?.object?.payment_method;
            if(billingInfoId && paymentMethodId) await updateBillingInfo(billingInfoId, { stripe_default_payment_method_id: paymentMethodId });
        }
        return res.status(200).json({status: "OK"})
    }catch(error){
        await createLog("billing/stripeWebhook", null, error.message, error)
        return res.status(500).json({error: "Internal server error"})
    }
}