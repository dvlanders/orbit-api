const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");

// You can go to Supabase database function to see what the function updates and returns
const fetchAndUpdatePendingWebhookMessages = async (
  event_category,
  retry_interval,
  max_retries
) => {
  const { data: events, error } = await supabase.rpc(
    "get_and_update_bridge_webhook_messages",
    {
      event_category_param: event_category,  
      retry_interval: retry_interval,
      max_retries: max_retries,
    }
  );

  if (error) {
    throw error;
  }

  return events;
};

const insertWebhookMessageHistory = async (event) => {
  const { error } = await supabaseCall(() =>
    supabase.from("bridge_webhook_messages_history").insert(event)
  );

  if (error) {
    throw error;
  }
};

const deleteWebhookMessage = async (id) => {
  const { error } = await supabaseCall(() =>
    supabase.from("bridge_webhook_messages").delete().eq("id", id)
  );

  if (error) {
    throw error;
  }
};

const completeWebhookMessage = async (id) => {
  const { error } = await supabaseCall(() =>
    supabase
      .from("bridge_webhook_messages")
      .update({
        process_status: "COMPLETE",
      })
      .eq("id", id)
  );

  if (error) {
    throw error;
  }
};

module.exports = {
  fetchAndUpdatePendingWebhookMessages,
  insertWebhookMessageHistory,
  deleteWebhookMessage,
  completeWebhookMessage,
};
