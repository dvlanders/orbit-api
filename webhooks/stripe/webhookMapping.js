const { processInvoiceEvent } = require("./processInvoiceEvent");
const { processSetupIntentEvent } = require("./processSetupIntentEvent");
const { processPaymentIntentEvent } = require("./processPaymentIntentEvent");
const { processProductEvent } = require("./processProductEvent");

const webhookMapping = {
  "invoice": processInvoiceEvent,
  "setup_intent": processSetupIntentEvent,
  "payment_intent": processPaymentIntentEvent,
  "product": processProductEvent,
};

const getStripeWebhookProcessor = (eventCategory) => {
  const processor = webhookMapping[eventCategory];
  if (!processor) {
    // throw new Error(`No event processor found for event category ${eventCategory}`);
    return async (event) => {};
  }
  return processor;
}

module.exports = { getStripeWebhookProcessor };