const { getEndorsementStatus } = require('../../src/util/bridge/utils');
const createLog = require("../../src/util/logger/supabaseLogger");
const notifyUserStatusUpdate = require("../../webhooks/user/notifyUserStatusUpdate");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");

const processCustomerEvent = async (event) => {
  const { id, status, endorsements } = event;

  try{
    const { status: baseStatus, actions: baseActions, fields: baseFields } = getEndorsementStatus(endorsements, "base")
    const { status: sepaStatus, actions: sepaActions, fields: sepaFields } = getEndorsementStatus(endorsements, "sepa")

    const { data: bridgeCustomer, error: updateError } = await supabaseCall(() => supabase
      .from('bridge_customers')
      .update({
        status: status,
        bridge_response: event,
        base_status: baseStatus,
        sepa_status: sepaStatus,
        updated_at: new Date().toISOString()
      })
      .eq('bridge_id', id)
      .select('*, users(is_developer)')
      .single());

  if (updateError) {
    console.error('Failed to update bridge customer status', updateError);
    await createLog('processCustomerEvent', null, 'Failed to update bridge customer status', updateError);
    return
  }
  if (!bridgeCustomer.is_developer) {
    await notifyUserStatusUpdate(bridgeCustomer.user_id)
  }

  }catch(error){
    await createLog(
      "webhooks/bridge/processCustomerEvent",
      null,
      `Failed to process customer event with bridge user id ${id}`,
      error
    );
    throw error;
  }
};

module.exports = {
  processCustomerEvent,
};
