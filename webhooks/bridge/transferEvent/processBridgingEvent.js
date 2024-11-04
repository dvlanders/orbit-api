const supabase = require("../../../src/util/supabaseClient");
const { supabaseCall } = require("../../../src/util/supabaseWithRetry");
const createLog = require("../../../src/util/logger/supabaseLogger");
const { HifiOfframpTransactionBridgeStatusMap, HifiOfframpTransactionFailedStatuses, HifiBridgingTransactionBridgeStatusMap, HifiBridgingTransactionFailedStatuses } = require("../../../src/util/bridge/utils");
const { updateBridgeTransactionRecord } = require("../../../src/util/bridge/bridgeTransactionTableService");
const { updateOfframpTransactionRecordAtomic } = require("../../../src/util/transfer/cryptoToBankAccount/utils/offrampTransactionsTableService");
const notifyTransaction = require("../../../src/util/logger/transactionNotifier");
const { rampTypes } = require("../../../src/util/transfer/utils/ramptType");
const notifyCryptoToFiatTransfer = require("../../transfer/notifyCryptoToFiatTransfer");
const { isValidBridgeStateTransition } = require("../../../src/util/bridge/utils");
const { updateBridgingTransactionRecord } = require("../../../src/util/transfer/bridging/bridgingTransactionTableService");
const notifyBridgingUpdate = require("../../bridging/notifyBridgingUpdate");

const processBridgingEvent = async (event) => {
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

    if(!client_reference_id) return await createLog("webhook/processBridgingEvent", null, `There is no client_reference_id in the event for event id: ${id}`);
    if (state == "awaiting_funds") return;
    // get the original offramp record
    const {data: bridgingRecord, error: bridgingRecordError} = await supabaseCall(() => supabase
        .from('bridging_transactions')
        .select('id, status, updated_at, bridge_transaction_info:bridge_transaction_record_id(bridge_status, id)')
        .eq('id', client_reference_id)
        .maybeSingle());
    
    if(bridgingRecordError) throw bridgingRecordError;

    if (!bridgingRecord) return await createLog("webhook/processBridgingEvent", null, `Bridging record not found for client_reference_id ${client_reference_id}.`);

    // check whether the state transition is valid since we can process webhook events out of order
    if(!isValidBridgeStateTransition(bridgingRecord.bridge_transaction_info?.bridge_status, state)){
      return;
    }

    const currentUpdatedAt = bridgingRecord.updated_at;

    const toUpdate = {
      status: HifiBridgingTransactionBridgeStatusMap[state] || "UNKNOWN"
    }
    const updatedBridgingRecord = await updateBridgingTransactionRecord(bridgingRecord.id, toUpdate);

    if(!updatedBridgingRecord){
        throw new Error(`Concurrent update detected. Please retry processing bridging transaction record with id ${bridgingRecord.id} for event ${id}`);
    }

    const toUpdateBridge = {
      bridge_response: event,
      bridge_status: state
    }
    const updatedBridgeRecord = await updateBridgeTransactionRecord(bridgingRecord.bridge_transaction_info.id, toUpdateBridge);

    if (HifiBridgingTransactionFailedStatuses.includes(updatedBridgingRecord.status)) {
      await notifyTransaction(
              updatedBridgingRecord.source_user_id,
              rampTypes.BRIDGING,
              updatedBridgingRecord.id,
                {
                  prevTransactionStatus: bridgingRecord.status,
                  updatedTransactionStatus: updatedBridgingRecord.status,
                  bridgeTransactionStatus: updatedBridgingRecord.bridge_status,
                  failedReason: updatedBridgingRecord.failed_reason,
                }
            );
    }

    if (bridgingRecord.status == updatedBridgingRecord.status) return;

    await notifyBridgingUpdate(updatedBridgingRecord);

  }catch(error){
    await createLog(
      "webhooks/bridge/processBridgingEvent",
      null,
      `Failed to process event with bridge transaction id ${id} with offramp transaction id: ${client_reference_id}`,
      error
    );
    throw error;
  }
};

module.exports = {
  processBridgingEvent
}