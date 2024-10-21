const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require("../../src/util/logger/supabaseLogger");
const { BridgeTransactionStatusMap, virtualAccountPaymentRailToChain } = require("../../src/util/bridge/utils");
const { v4: uuidv4 } = require("uuid");
const notifyFiatToCryptoTransfer = require("../transfer/notifyFiatToCryptoTransfer");
const { createTransactionFeeRecord } = require("../../src/util/billing/fee/transactionFeeBilling");
const { insertSingleBridgeTransactionRecord, updateBridgeTransactionRecord } = require("../../src/util/bridge/bridgeTransactionTableService");
const { updateOnrampTransactionRecord, insertSingleOnrampTransactionRecord } = require("../../src/util/transfer/fiatToCrypto/utils/onrampTransactionTableService");
const { transferType } = require("../../src/util/transfer/utils/transfer");
const notifyTransaction = require("../../src/util/logger/transactionNotifier");
const { rampTypes } = require("../../src/util/transfer/utils/ramptType");
const { chargeFeeOnFundReceivedScheduleCheck } = require("../../asyncJobs/transfer/chargeFeeOnFundReceivedBastion/scheduleCheck");
const { isValidBridgeStateTransition } = require("../../src/util/bridge/utils");
const createJob = require("../../asyncJobs/createJob");

// This will process the onramp transaction that has a reference_id, but no deposit id.
const processExistingOnrampTransaction = async (existingRecord, event) => {
  const { id, type, deposit_id, destination_tx_hash } = event;

  const currentBridgeStatus = existingRecord.bridge_transaction_info?.bridge_status;
  if(!isValidBridgeStateTransition(currentBridgeStatus, type)) return { originalOnrampRecord: existingRecord, updatedOnrampRecord: null };
  
  const toUpdate = {
    status: type in BridgeTransactionStatusMap ? BridgeTransactionStatusMap[type] : "UNKNOWN",
    transaction_hash: destination_tx_hash
  }
  const updatedOnrampRecord = await updateOnrampTransactionRecord(existingRecord.id, toUpdate);

  const toUpdateBridge = {
    bridge_response: event,
    bridge_status: type,
    bridge_deposit_id: deposit_id,
    last_bridge_virtual_account_event_id: id,
  }
  await updateBridgeTransactionRecord(updatedOnrampRecord.bridge_transaction_record_id, toUpdateBridge);

  return { originalOnrampRecord: existingRecord, updatedOnrampRecord: updatedOnrampRecord };

}

// This will process unseen manual deposit onramp transactions
const processManualOnrampTransaction = async (event) => {
  const { id, type, amount, deposit_id, destination_tx_hash, virtual_account_id, customer_id } = event;

  const { data: virtualAccount, error: virtualAccountError } = await supabaseCall(() => supabase
        .from("bridge_virtual_accounts")
        .select("id, user_id, source_currency, destination_payment_rail, destination_currency")
        .eq("virtual_account_id", virtual_account_id)
        .limit(1)
        .maybeSingle());

  if (virtualAccountError) {
    throw virtualAccountError;
  }

  if(!virtualAccount) return null; // this transaction is created in the dev_production database, so we don't need to process it

  const userId = virtualAccount.user_id;

  const toInsert = {
    request_id: uuidv4(),
    user_id: userId,
    amount: amount,
    destination_user_id: userId,
    status: type in BridgeTransactionStatusMap ? BridgeTransactionStatusMap[type]: "UNKNOWN",
    transaction_hash: destination_tx_hash,
    fiat_provider: "MANUAL_DEPOSIT",
    crypto_provider: "BRIDGE",
    source_currency: virtualAccount.source_currency,
    destination_currency: virtualAccount.destination_currency,
    chain: virtualAccountPaymentRailToChain[virtualAccount.destination_payment_rail],
    source_manual_deposit: event.source,
    billing_tags_success: ["base"],
    billing_tags_failed: []
  }

  const onrampRecord = await insertSingleOnrampTransactionRecord(toInsert);

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
  const feeTransaction = await createTransactionFeeRecord(onrampRecord.id, transferType.FIAT_TO_CRYPTO);
  await updateOnrampTransactionRecord(onrampRecord.id, { fee_transaction_id: feeTransaction.id, bridge_transaction_record_id: bridgeRecord.id });

  return { originalOnrampRecord: null, updatedOnrampRecord: onrampRecord };

}

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

  const { description, sender_name, payment_rail, sender_bank_routing_number } = event.source;

  try {

    if(type === "funds_scheduled" || type === "microdeposit") return; // funds_scheduled or microdeposit events have no "deposit_id", so nothing to do here
    if(!deposit_id) return; // extra measure

    // Check if we have an existing onramp record with this deposit_id
    const { data: existingBridgeRecord, error: existingBridgeRecordError } = await supabaseCall(() => supabase
      .from("bridge_transactions")
      .select("id")
      .eq("bridge_deposit_id", deposit_id)
      .maybeSingle());

    if (existingBridgeRecordError) throw existingBridgeRecordError;

    let originalOnrampRecord, updatedOnrampRecord;

    if(existingBridgeRecord){ // If an existing deposit_id found, we will process it

      const { data: onrampRecord, error: onrampRecordError } = await supabaseCall(() => supabase
        .from("onramp_transactions")
        .select("id, bridge_transaction_info:bridge_transaction_record_id(bridge_status)")
        .eq("bridge_transaction_record_id", existingBridgeRecord.id)
        .single());

      if(onrampRecordError) throw onrampRecordError;

      ({ originalOnrampRecord, updatedOnrampRecord } = await processExistingOnrampTransaction(onrampRecord, event));

    }else{ // If no existing deposit_id found, we try to find an existing onramp record with a matching referenceId

      const referenceId = description?.split(" ")?.slice(-5)?.join("-")?.toLowerCase();

      if(referenceId){

        // Check if we have existing onramp records with this referenceId, either fully match or partially match
        const { data: matchingRecords, error: matchingRecordsError } = await supabaseCall(() => supabase
          .from("onramp_transactions")
          .select("id, bridge_transaction_info:bridge_transaction_record_id(bridge_status)")
          .like("reference_id", `%${referenceId}%`));

        if(matchingRecordsError) throw matchingRecordsError;

        if (matchingRecords.length == 1) { // If an exsiting onramp record found, we will process it
          ({ originalOnrampRecord, updatedOnrampRecord } = await processExistingOnrampTransaction(matchingRecords[0], event));
        } else if (matchingRecords.length > 1) { // This should never happen in theory
          throw new Error(`Multiple onramp transactions found for partial matching referenceId: ${referenceId}`);
        }

      }

      // if no referenceId or no existing onramp records with this referenceId, we will process it as a new manual deposit onramp transaction
      if(!originalOnrampRecord){
        ({ originalOnrampRecord, updatedOnrampRecord } = await processManualOnrampTransaction(event));
      }

    }

    if(!updatedOnrampRecord){
      console.log("Process out of order events, so nothing to do here");
      return; // no updates are done, so nothing to do here
    }

    const { data: onrampRecord, error: onrampRecordError} = await supabaseCall(() => supabase
      .from('onramp_transactions')
      .select('id, user_id, fiat_provider, crypto_provider, destination_user_id, developer_fee_id, status, destination_user: destination_user_id(profile_id), checkbook_transaction_record_id, bridge_transaction_record_id, checkbook_transaction_info:checkbook_transaction_record_id(*), bridge_transaction_info:bridge_transaction_record_id(*)')
      .eq('id', updatedOnrampRecord.id)
      .single());

    if(onrampRecordError) throw onrampRecordError;

    const bridgeTransactionInfo = onrampRecord.bridge_transaction_info;
    const checkbookTransactionInfo = onrampRecord.checkbook_transaction_info;

    if (onrampRecord.developer_fee_id) {
      const jobConfig = {recordId: onrampRecord.id}
      const canSchedule = await chargeFeeOnFundReceivedScheduleCheck("chargeFeeOnFundReceived", jobConfig, onrampRecord.destination_user_id, onrampRecord.destination_user.profile_id)
      if (canSchedule){
        await createJob("chargeFeeOnFundReceived", jobConfig, onrampRecord.destination_user_id, onrampRecord.destination_user.profile_id, new Date().toISOString(), 0, new Date(new Date().getTime() + 60000).toISOString())
      }
    }

    if (onrampRecord.status === "REFUNDED") {
      notifyTransaction(
          onrampRecord.user_id,
          rampTypes.ONRAMP,
          onrampRecord.id,
          {
              prevTransactionStatus: originalOnrampRecord?.status,
              updatedTransactionStatus: onrampRecord.status,
              checkbookStatus: checkbookTransactionInfo.checkbook_status,
              bridgeStatus: bridgeTransactionInfo.bridge_status,
              failedReason: onrampRecord.failed_reason,
          }
      );
  }

    await notifyFiatToCryptoTransfer(onrampRecord);

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
