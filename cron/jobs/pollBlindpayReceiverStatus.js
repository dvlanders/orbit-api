const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const supabase = require("../../src/util/supabaseClient");
const createLog = require("../../src/util/logger/supabaseLogger");
const notifyReceiverStatusUpdate = require("../../webhooks/blindpay/notifyReceiverStatusUpdate");

const updateStatus = async (receiver) => {
  try {
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.BLINDPAY_API_KEY}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(
      `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/receivers/${receiver.blindpay_receiver_id}`,
      {
        method: "GET",
        headers: headers,
      }
    );

    const responseBody = await response.json();
    console.log(responseBody);

    if (!response.ok) {
      await createLog(
        "pollBlindpayReceiverStatus",
        receiver.user_id,
        `Failed to get receiver from Blindpay: user id: ${receiver.user_id}, receiver id: ${receiver.id}, blindpay receiver id: ${receiver.blindpay_receiver_id}`,
        responseBody
      );
    }

    const kyc_status = responseBody.kyc_status;
    if (receiver.kyc_status != kyc_status) {
      console.log("Update receiver status for receiver", responseBody);
      const { error: updateError } = await supabaseCall(() =>
        supabase
          .from("blindpay_receivers_kyc")
          .update({
            kyc_status: kyc_status,
            blindpay_response: responseBody,
            updated_at: new Date().toISOString(),
          })
          .eq("id", receiver.id)
      );

      if (updateError) {
        await createLog(
          "pollBlindpayReceiverStatus",
          receiver.user_id,
          `Failed to update Blindpay receiver kyc status: user id: ${receiver.user_id}, receiver id: ${receiver.id}, blindpay receiver id: ${receiver.blindpay_receiver_id}`,
          updateError
        );
      }
      await notifyReceiverStatusUpdate(
        receiver.user_id,
        receiver.id,
        kyc_status
      );
    }
  } catch (error) {
    await createLog(
      "pollBlindpayReceiverStatus",
      receiver.user_id,
      "Failed to fetch receiver status from Blindpay API",
      error
    );
  }
};

async function pollBlindpayReceiverStatus() {
  const { data: receiverData, error: receiverDataError } = await supabaseCall(
    () =>
      supabase
        .from("blindpay_receivers_kyc")
        .update({ updated_at: new Date().toISOString() })
        .eq("kyc_status", "verifying")
        .order("updated_at", { ascending: true })
        .select("id, user_id, blindpay_receiver_id, kyc_status")
  );

  if (receiverDataError) {
    await createLog(
      "pollBlindpayReceiverStatus",
      null,
      "Failed to fetch Blindpay receiver",
      receiverDataError
    );
    return;
  }

  await Promise.all(
    receiverData.map(async (receiver) => await updateStatus(receiver))
  );
}

module.exports = pollBlindpayReceiverStatus;
