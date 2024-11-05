const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require("../../src/util/logger/supabaseLogger");
const { processOfframpTransferEvent } = require("./transferEvent/processOfframpTransferEvent");
const { processBridgingEvent } = require("./transferEvent/processBridgingEvent");



const processTransferEvent = async (event) => {
  // get the event type from bridge_transaction table
  const {data: bridgeTransaction, error: bridgeTransactionError} = await supabaseCall(() => supabase
    .from('bridge_transactions')
    .select('transfer_type')
    .eq('bridge_transfer_id', event.id)
    .maybeSingle());
  
  if(bridgeTransactionError) throw bridgeTransactionError;
  if(!bridgeTransaction) return await createLog("webhook/processTransferEvent", null, `Bridge transaction not found for bridge transfer id: ${event.id}, the event is most likely in dev_production database`);

  const transferType = bridgeTransaction.transfer_type;

  if (transferType == "BRIDGE_ASSET"){
    await processBridgingEvent(event);
  }else{
    // default to offramp
    await processOfframpTransferEvent(event);
  }


}


module.exports = {
  processTransferEvent,
};
