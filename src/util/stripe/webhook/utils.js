const stripeWebhookEventRequiredFields = [
    "id",
    "api_version",
    "type",
    "created",
    "data",
  ];
  
  const stripeWebhookEventAcceptedFields = {
    id: "string",
    object: "string",
    api_version: "string",
    created: "number",
    data: "object",
    livemode: "boolean",
    pending_webhooks: "number",
    request: "object",
    type: "string",
  };
  
  module.exports = {
    stripeWebhookEventRequiredFields,
    stripeWebhookEventAcceptedFields,
  };
  