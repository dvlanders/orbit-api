const createLog = require("../../src/util/logger/supabaseLogger");
const { getStripeWebhookProcessor } = require("../../webhooks/stripe/webhookMapping");
const {
  fetchAndUpdatePendingWebhookMessages,
  completeWebhookMessage,
  insertWebhookMessageHistory,
  deleteWebhookMessage,
  incrementWebhookMessageRetryCount
} = require("../../webhooks/stripe/webhookMessagesService");

const RETRY_INTERVAL = 60; // 60 secs
const MAX_RETRIES = 100;

const pollStripeWebhookEvents = async () => {
  try {
    const events = await fetchAndUpdatePendingWebhookMessages(
      RETRY_INTERVAL
    );

    await Promise.all(
      events.map(async (event) => {
        const {id, event_id, event_type, event_data, full_event, retry_count} = event;
        let caughtError = null;
        try {
          await incrementWebhookMessageRetryCount(event);
          const eventProcessor = getStripeWebhookProcessor(event_type?.split(".")[0]);
          await eventProcessor(full_event);
          await completeWebhookMessage(id);
        } catch (error) {
          caughtError = error;
          await createLog(
            "pollStripeWebhookEvents",
            null,
            `Failed to process event id ${id}`,
            error
          );
          if (retry_count >= MAX_RETRIES) {
            await createLog(
              "pollStripeWebhookEvents",
              null,
              `Webhook event ${id} has been retried ${retry_count} times`,
              error
            );
          }
        } finally {
          const eventHistory = 
          {
            event_id: event_id,
            event_type: event_type,
            success: !caughtError,
            full_event: full_event,
            error: caughtError ? { message: caughtError.message } : null,
          }

          await insertWebhookMessageHistory(eventHistory);
          // only delete webhook message if it is successfully inserted into job history and was processed successfully
          if(eventHistory.success){
            await deleteWebhookMessage(id);
          }
        }
      })
    );
  } catch (error) {
    await createLog("pollStripeWebhookEvents", null, error.message, error);
  }
};

module.exports = pollStripeWebhookEvents;
