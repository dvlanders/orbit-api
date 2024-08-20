const createLog = require("../../src/util/logger/supabaseLogger");
const { webhookMapping } = require("../../webhooks/bridge/webhookMapping");
const {
  fetchAndUpdatePendingWebhookMessages,
  completeWebhookMessage,
} = require("../../webhooks/bridge/webhookMessagesService");

const RETRY_INTERVAL = 60; // 60 secs
const MAX_RETRIES = 100;

const pollBridgeWebhookEvents = async () => {
  try {
    const events = await fetchAndUpdatePendingWebhookMessages(
      "virtual_account.activity",
      RETRY_INTERVAL,
      MAX_RETRIES
    );

    await Promise.all(
      events.map(async (event) => {
        try {
          const event_object = event.event_object;
          const eventProcessor = webhookMapping[event.event_category];
          if (await eventProcessor(event_object)) {
            await completeWebhookMessage(event.id);
          }
        } catch (error) {
          await createLog(
            "pollBridgeWebhookEvents",
            null,
            `Failed to process event id ${event.id}`,
            error
          );
          if (event.retry_count >= RETRY_INTERVAL) {
            await createLog(
              "pollBridgeWebhookEvents",
              null,
              `Webhook event ${event.id} has been retried ${event.retry_count} times`,
              error
            );
          }
        }
      })
    );
  } catch (error) {
    await createLog("pollBridgeWebhookEvents", null, error.message, error);
  }
};

module.exports = pollBridgeWebhookEvents;
