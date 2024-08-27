const bridgeWebhookEventRequiredFields = [
  "api_version",
  "event_id",
  "event_category",
  "event_type",
  "event_object_id",
  "event_object_status",
  "event_object",
  "event_object_changes",
  "event_created_at",
];

const bridgeWebhookEventAcceptedFields = {
  api_version: "string",
  event_id: "string",
  event_sequence: "string",
  event_category: "string",
  event_type: "string",
  event_object_id: "string",
  event_object_status: ["string", "object"],
  event_object: "object",
  event_object_changes: "object",
  event_created_at: "string",
};

module.exports = {
  bridgeWebhookEventRequiredFields,
  bridgeWebhookEventAcceptedFields,
};
