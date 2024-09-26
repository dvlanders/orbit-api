const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");

// You can go to Supabase database function to see what the function updates and returns
const fetchAndUpdatePendingWebhookMessages = async (
  retry_interval,
) => {
  const now =  new Date();
  const { data, error} = await supabaseCall(() => supabase
    .from("stripe_webhook_messages")
    .update({
      next_retry_at: new Date(now.getTime() + retry_interval * 1000).toISOString(),
    })
    .eq("process_status", "PENDING")
    .lte("next_retry_at", now.toISOString())
    .select()
  )

  if (error) {
    throw error;
  }

  return data;
};

const insertWebhookMessageHistory = async (event) => {
  const { error } = await supabaseCall(() =>
    supabase.from("stripe_webhook_messages_history").insert(event)
  );

  if (error) {
    throw error;
  }
};

const deleteWebhookMessage = async (id) => {
  const { error } = await supabaseCall(() =>
    supabase.from("stripe_webhook_messages").delete().eq("id", id)
  );

  if (error) {
    throw error;
  }
};

const completeWebhookMessage = async (id) => {
  const { error } = await supabaseCall(() =>
    supabase
      .from("stripe_webhook_messages")
      .update({
        process_status: "COMPLETE",
      })
      .eq("id", id)
  );

  if (error) {
    throw error;
  }
};

const incrementWebhookMessageRetryCount = async (record) => {
  const { error } = await supabaseCall(() =>
    supabase
      .from("stripe_webhook_messages")
      .update({
        retry_count: record.retry_count + 1
      })
      .eq("id", record.id)
  );

  if (error) {
    throw error;
  }
}

module.exports = {
  fetchAndUpdatePendingWebhookMessages,
  insertWebhookMessageHistory,
  deleteWebhookMessage,
  completeWebhookMessage,
  incrementWebhookMessageRetryCount
};
