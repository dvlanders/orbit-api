const createLog = require("../../src/util/logger/supabaseLogger");
const { getWebhookProcessor } = require("../../webhooks/reap/webhookMapping");
const {
  fetchAndUpdatePendingWebhookMessages,
  completeWebhookMessage,
  insertWebhookMessageHistory,
  deleteWebhookMessage,
  incrementWebhookMessageRetryCount
} = require("../../webhooks/reap/webhookMessagesService");

const RETRY_INTERVAL = 60; // 60 secs
const MAX_RETRIES = 100;

const pollReapWebhookEvents = async () => {
  try {
    const events = await fetchAndUpdatePendingWebhookMessages(
      RETRY_INTERVAL
    );

    await Promise.all(
      events.map(async (event) => {
        let caughtError = null;
        try {
          await incrementWebhookMessageRetryCount(event);
          const event_object = event.event_object;
          const eventProcessor = getWebhookProcessor(event.event_type);
          await eventProcessor(event_object);
          await completeWebhookMessage(event.id);
        } catch (error) {
          caughtError = error;
          await createLog(
            "pollReapWebhookEvents",
            null,
            `Failed to process event id ${event.id}`,
            error
          );
          if (event.retry_count >= MAX_RETRIES) {
            await createLog(
              "pollReapWebhookEvents",
              null,
              `Webhook event ${event.id} has been retried ${event.retry_count} times`,
              error
            );
          }
        } finally {
          const eventHistory = {
            event_category: event.event_category,
            event_type: event.event_type,
            full_event: event.full_event,
            success: !caughtError,
            error: caughtError ? { message: caughtError.message } : null,
          };

          await insertWebhookMessageHistory(eventHistory);
          // only delete webhook message if it is successfully inserted into job history and was processed successfully
          if(eventHistory.success){
            await deleteWebhookMessage(event.id);
          }
        }
      })
    );
  } catch (error) {
    await createLog("pollReapWebhookEvents", null, error.message, error);
  }
};

module.exports = pollReapWebhookEvents;
