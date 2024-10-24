const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require("../../src/util/logger/supabaseLogger");
const { HifiOfframpTransactionBridgeStatusMap, HifiOfframpTransactionFailedStatuses } = require("../../src/util/bridge/utils");
const { updateBridgeTransactionRecord } = require("../../src/util/bridge/bridgeTransactionTableService");
const { updateOfframpTransactionRecord } = require("../../src/util/transfer/cryptoToBankAccount/utils/offrampTransactionsTableService");
const notifyTransaction = require("../../src/util/logger/transactionNotifier");
const { rampTypes } = require("../../src/util/transfer/utils/ramptType");
const notifyCryptoToFiatTransfer = require("../transfer/notifyCryptoToFiatTransfer");
const { isValidBridgeStateTransition } = require("../../src/util/bridge/utils");

const processTransferEvent = async (event) => {
  const {
    id,
    state,
    amount,
    source,
    receipt,
    currency,
    created_at,
    updated_at,
    destination,
    on_behalf_of,
    developer_fee,
    client_reference_id,
    source_deposit_instructions,
  } = event;

  try{

    if(!client_reference_id) return await createLog("webhook/processTransferEvent", null, `There is no client_reference_id in the event for event id: ${id}`);

    // get the original offramp record
    const {data: offrampRecord, error: offrampRecordError} = await supabaseCall(() => supabase
        .from('offramp_transactions')
        .select('id, transaction_status, bridge_transaction_info:bridge_transaction_record_id(bridge_status)')
        .eq('id', client_reference_id)
        .maybeSingle());
    
    if(offrampRecordError) throw offrampRecordError;

    if (!offrampRecord) return await createLog("webhook/processTransferEvent", null, `Offramp record not found for client_reference_id ${client_reference_id}. The record is most likely in dev_production database.`);

    // check whether the state transition is valid since we can process webhook events out of order
    if(!isValidBridgeStateTransition(offrampRecord.bridge_transaction_info?.bridge_status, state)){
      return;
    }

    const toUpdate = {
      transaction_status: HifiOfframpTransactionBridgeStatusMap[state] || "UNKNOWN"
    }
    const updatedOfframpRecord = await updateOfframpTransactionRecord(offrampRecord.id, toUpdate);

    const toUpdateBridge = {
      bridge_response: event,
      bridge_status: state
    }
    const updatedBridgeRecord = await updateBridgeTransactionRecord(updatedOfframpRecord.bridge_transaction_record_id, toUpdateBridge);

    if (HifiOfframpTransactionFailedStatuses.includes(updatedOfframpRecord.transaction_status)) {
      await notifyTransaction(
              updatedOfframpRecord.user_id,
              rampTypes.OFFRAMP,
              updatedOfframpRecord.id,
                {
                  prevTransactionStatus: offrampRecord.transaction_status,
                  updatedTransactionStatus: updatedOfframpRecord.transaction_status,
                  bridgeTransactionStatus: updatedBridgeRecord.bridge_status,
                  failedReason: updatedOfframpRecord.failed_reason,
                }
            );
    }

    if (offrampRecord.transaction_status == updatedOfframpRecord.transaction_status) return;

    await notifyCryptoToFiatTransfer(updatedOfframpRecord);

  }catch(error){
    await createLog(
      "webhooks/bridge/processTransferEvent",
      null,
      `Failed to process event with id ${id} with client_reference_id: ${client_reference_id}`,
      error
    );
    throw error;
  }
};

module.exports = {
  processTransferEvent,
};
