const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require("../../src/util/logger/supabaseLogger");
const { BridgeTransactionStatusMap, virtualAccountPaymentRailToChain } = require("../../src/util/bridge/utils");
const { isUUID } = require("../../src/util/common/fieldsValidation");
const { v4: uuidv4 } = require("uuid");
const notifyFiatToCryptoTransfer = require("../transfer/notifyFiatToCryptoTransfer");
const { createTransactionFeeRecord } = require("../../src/util/billing/fee/transactionFeeBilling");
const { insertSingleBridgeTransactionRecord, updateBridgeTransactionRecord } = require("../../src/util/bridge/bridgeTransactionTableService");
const { transferType } = require("../../src/util/transfer/utils/transfer");

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

    if(type === "funds_scheduled" || type === "microdeposit") return; // funds_scheduled events have no "deposit_id", so nothing to do here
    const referenceId = description
      ?.split(" ")
      ?.slice(-5)
      ?.join("-")
      ?.toLowerCase();

    // if we can parse a referenceId, then we check whether this event is for an existing onramp transaction
    if (referenceId && referenceId != "") {
      let existingTransaction, bridgeTransactionInfo
      if (isUUID(referenceId)){
          // match exact uuid
          const { data, error } =
          await supabaseCall(() =>
            supabase
              .from("onramp_transactions")
              .select("id, request_id, user_id, destination_user_id, amount, created_at, updated_at, status, fiat_provider, crypto_provider, bridge_transaction_record_id, bridge_transaction_info:bridge_transaction_record_id(*)")
              .eq("id", referenceId)
              .maybeSingle()
          );

        if (error) {
          throw error;
        }

        existingTransaction = data
        bridgeTransactionInfo = data?.bridge_transaction_info
      }else{
        // match partial uuid
        const { data, error } =
          await supabaseCall(() =>
            supabase
              .from("onramp_transactions")
              .select("id, request_id, user_id, destination_user_id, amount, created_at, updated_at, status, fiat_provider, crypto_provider, bridge_transaction_record_id, bridge_transaction_info:bridge_transaction_record_id(*)")
              .like("reference_id", `%${referenceId}%`)
          );

        if (error) {
          throw error;
        }

        if (data.length == 1) {
          existingTransaction = data[0];
          bridgeTransactionInfo = data[0]?.bridge_transaction_info;
        } else if (data.length > 1) {
          throw new Error("Multiple onramp transactions found for referenceId " + referenceId)
        }
      }

      if (existingTransaction && !bridgeTransactionInfo.bridge_deposit_id) {
        await updateBridgeTransactionRecord(bridgeTransactionInfo.id, { bridge_deposit_id: deposit_id });
        await notifyFiatToCryptoTransfer(existingTransaction);
      }

      // dont need to process existing onramp transactions
      if (existingTransaction) {
        return;
      }

    }

    // check if this manual deposit event has already been inserted into the bridge_transactions table
    const { data: existingRecord, error: existingRecordError } =
      await supabaseCall(() =>
        supabase
          .from("bridge_transactions")
          .select("id")
          .eq("bridge_deposit_id", deposit_id)
          .maybeSingle()
      );

    if (existingRecordError) {
      throw existingRecordError;
    }

    // this manual deposit event has already been inserted into the bridge_transactions table
    if (existingRecord) {
      return;
    }

    const { data: virtualAccount, error: virtualAccountError } =
      await supabaseCall(() =>
        supabase
          .from("bridge_virtual_accounts")
          .select("id, user_id, source_currency, destination_payment_rail, destination_currency")
          .eq("virtual_account_id", virtual_account_id)
          .limit(1)
          .maybeSingle()
      );

    if (virtualAccountError) {
      throw virtualAccountError;
    }

    if(!virtualAccount) return; // this transaction is created in the dev_production database, so we don't need to process it

    const userId = virtualAccount.user_id;

    const { data: initialRecord, error: initialRecordError } = await supabase
        .from("onramp_transactions")
        .insert(
          {
            request_id: uuidv4(),
            user_id: userId,
            amount: amount,
            destination_user_id: userId,
            status:
              type in BridgeTransactionStatusMap
                ? BridgeTransactionStatusMap[type]
                : "UNKNOWN",
            transaction_hash: destination_tx_hash,
            fiat_provider: "MANUAL_DEPOSIT",
            crypto_provider: "BRIDGE",
            source_currency: virtualAccount.source_currency,
            destination_currency: virtualAccount.destination_currency,
            chain: virtualAccountPaymentRailToChain[virtualAccount.destination_payment_rail],
            source_manual_deposit: event.source,
            billing_tags_success: ["base"],
            billing_tags_failed: []
        })
        .select("id, request_id, user_id, destination_user_id, amount, created_at, updated_at, status, fiat_provider, crypto_provider")
        .single()

    if (initialRecordError) {
      throw initialRecordError;
    }

    const toInsertBridgeRecord = {
      user_id: userId,
      request_id: v4(),
      virtual_account_id: virtualAccount.id,
      bridge_virtual_account_id: virtual_account_id,
      last_bridge_virtual_account_event_id: id,
      bridge_status: type,
      bridge_response: event,
      bridge_deposit_id: deposit_id,
      bridge_user_id: customer_id
    }

    const bridgeRecord = await insertSingleBridgeTransactionRecord(toInsertBridgeRecord);

    const feeTransaction = await createTransactionFeeRecord(initialRecord.id, transferType.FIAT_TO_CRYPTO);
    await supabase.from("onramp_transactions").update({ fee_transaction_id: feeTransaction.id, bridge_transaction_record_id: bridgeRecord.id }).eq("id", initialRecord.id);

    await notifyFiatToCryptoTransfer(initialRecord);
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
