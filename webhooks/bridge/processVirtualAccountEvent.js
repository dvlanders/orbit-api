const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require("../../src/util/logger/supabaseLogger");
const { BridgeTransactionStatusMap } = require("../../src/util/bridge/utils");
const { isUUID } = require("../../src/util/common/fieldsValidation");

const processVirtualAccountEvent = async (event) => {
  const {
    id,
    type,
    amount,
    gas_fee,
    currency,
    created_at,
    deposit_id,
    customer_id,
    subtotal_amount,
    virtual_account_id,
    destination_tx_hash,
    exchange_fee_amount,
    developer_fee_amount,
  } = event;

  const { description, sender_name, payment_rail, sender_bank_routing_number } =
    event.source;

  try {
    const referenceId = description
      .split(" ")
      .slice(-5)
      .join("-")
      .toLowerCase();

    // if we can parse a referenceId, then we check whether this event is for an existing onramp transaction
    if (isUUID(referenceId)) {
      const { data: existingTransaction, error: existingTransactionError } =
        await supabaseCall(() =>
          supabase
            .from("onramp_transactions")
            .select("id, bridge_deposit_id")
            .eq("id", referenceId)
        );

      if (existingTransactionError) {
        throw existingTransactionError;
      }

      if (existingTransaction && !existingTransaction.bridge_deposit_id) {
        const { error: updateTransactionError } = await supabaseCall(() =>
          supabase
            .from("onramp_transactions")
            .update({ bridge_deposit_id: deposit_id })
            .eq("id", referenceId)
        );

        if (updateTransactionError) {
          throw updateTransactionError;
        }
      }

      // dont need to process existing onramp transactions
      if (existingTransaction) {
        return;
      }
    }

    // check if this manual deposit event has already been inserted into the onramp_transactions table
    const { data: existingRecord, error: existingRecordError } =
      await supabaseCall(() =>
        supabase
          .from("onramp_transactions")
          .select("id")
          .eq("bridge_deposit_id", deposit_id)
          .maybeSingle()
      );

    if (existingRecordError) {
      throw existingRecordError;
    }

    // this manual deposit event has already been inserted into the onramp_transactions table
    if (existingRecord) {
      return;
    }

    const { data: virtualAccount, error: virtualAccountError } =
      await supabaseCall(() =>
        supabase
          .from("bridge_virtual_accounts")
          .select("user_id")
          .eq("virtual_account_id", virtual_account_id)
          .limit(1)
          .single()
      );

    if (virtualAccountError) {
      throw virtualAccountError;
    }
    const userId = virtualAccount.user_id;

    const { error: initialRecordError } = await supabaseCall(() =>
      supabase.from("onramp_transactions").upsert(
        {
          user_id: userId,
          amount: amount,
          destination_user_id: userId,
          bridge_virtual_account_id: virtual_account_id,
          last_bridge_virtual_account_event_id: id,
          bridge_status: type,
          bridge_response: event,
          status:
            type in BridgeTransactionStatusMap
              ? BridgeTransactionStatusMap[type]
              : "UNKNOWN",
          transaction_hash: destination_tx_hash,
          fiat_provider: "MANUAL_DEPOSIT",
          crypto_provider: "BRIDGE",
          bridge_deposit_id: deposit_id,
        },
        { onConflict: "bridge_deposit_id" }
      )
    );
    if (initialRecordError) {
      throw initialRecordError;
    }
  } catch (error) {
    await createLog(
      "webhooks/bridge/processVirtualAccountEvent",
      null,
      `Failed to process event with id ${id} and virtual account id ${virtual_account_id}`,
      error
    );
    throw error;
  }
};

module.exports = {
  processVirtualAccountEvent,
};
