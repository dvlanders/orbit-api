const createLog = require("../../util/logger/supabaseLogger");
const { supabaseCall } = require("../../util/supabaseWithRetry");
const supabase = require("../../util/supabaseClient");

exports.bridgeWebhook = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  // console.log(req.body);
  const {
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
    const { error } = await supabaseCall(() =>
      supabase.from("bridge_webhook_messages").upsert({
        event_id,
        event_category,
        event_type,
        event_object,
        event_object_id,
        event_object_status,
        event_object_changes,
        event_created_at,
      })
    );

    if (error) throw error;

    return res.status(200).json({ status: "OK" });
  } catch (error) {
    await createLog("webhook/bridgeWebhook", null, error.message, error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
