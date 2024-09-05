const createLog = require("../util/logger/supabaseLogger");
const { supabaseCall } = require("../util/supabaseWithRetry");
const supabase = require("../util/supabaseClient");
const { fieldsValidation } = require("../util/common/fieldsValidation");
const { bridgeWebhookEventRequiredFields, bridgeWebhookEventAcceptedFields } = require("../util/bridge/webhook/utils");

exports.bridgeWebhook = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  // console.log(req.body);
  const {
    api_version,
    event_sequence,
    event_id,
    event_category,
    event_type,
    event_object_id,
    event_object_status,
    event_object,
    event_object_changes,
    event_created_at,
  } = req.body;
  try {

    const { missingFields, invalidFields } = fieldsValidation(req.body, bridgeWebhookEventRequiredFields, bridgeWebhookEventAcceptedFields)
	  if (missingFields.length > 0 || invalidFields.length > 0) {
		  await createLog("webhook/bridgeWebhook", null, "Bridge webhook might have changed their event structure", { missingFields, invalidFields });
	  }
    const now = new Date().toISOString();
    // insert or update incoming Bridge webhook messages.
    const { error } = await supabaseCall(() =>
      supabase.from("bridge_webhook_messages").upsert(
        {
          event_id,
          event_category,
          event_type,
          event_object,
          event_object_id,
          event_object_status,
          event_object_changes,
          event_created_at,
          full_event: req.body,
          process_status: "PENDING",
          updated_at: now,
          retry_count: 0,
          next_retry_at: now,
        },
        { onConflict: "event_id" }
      )
    );

    if (error) throw error;

    return res.status(200).json({ status: "OK" });
  } catch (error) {
    await createLog("webhook/bridgeWebhook", null, error.message, error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.reapWebhook = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  // console.log(req.body);
  const {
    eventType,
    eventName,
    data
  } = req.body;
  try {

    const now = new Date().toISOString();
    // insert or update incoming Bridge webhook messages.
    const { error } = await supabase
        .from("reap_webhook_messages")
        .insert(
          {
            event_category: eventType,
            event_type: eventName,
            event_object: data,
            full_event: req.body,
            process_status: "PENDING",
            retry_count: 0,
            next_retry_at: now,
          }
        )

    if (error) throw error;

    return res.status(200).json({ status: "OK" });
  } catch (error) {
    await createLog("webhook/reapWebhook", null, error.message, error);
    return res.status(500).json({ error: "Internal server error" });
  }
};