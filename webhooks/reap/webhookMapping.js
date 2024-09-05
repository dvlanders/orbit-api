const processPaymentEvent = require("./processPaymentEvent");


const webhookMapping = {
  "payment_status_update": processPaymentEvent,
  "balance_update_fund_in": () => true,
};

const getWebhookProcessor = (eventCategory) => {
  const processor = webhookMapping[eventCategory];
  if (!processor) {
    throw new Error(`No event processor found for event category ${eventCategory}`);
  }
  return processor;
}

module.exports = { getWebhookProcessor };