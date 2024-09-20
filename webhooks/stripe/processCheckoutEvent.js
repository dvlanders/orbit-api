const createLog = require("../../src/util/logger/supabaseLogger");
const { updateBalanceTopupRecord } = require("../../src/util/billing/balance/balanceService");
const { BalanceTopupType, BalanceTopupStatus } = require("../../src/util/billing/balance/utils");

const processCheckoutEvent = async (event) => {
  try {
    const metadata = event.data?.object?.metadata;
    const { type, profileId, topupRecordId } = metadata;

    if(event.type === "checkout.session.async_payment_failed"){
        if (type === BalanceTopupType.CHECKOUT) {
            await updateBalanceTopupRecord(topupRecordId, {status: BalanceTopupStatus.FAILED});
        }
    }else if(event.type === "checkout.session.expired"){
        if (type === BalanceTopupType.CHECKOUT) {
            await updateBalanceTopupRecord(topupRecordId, {status: BalanceTopupStatus.CANCELLED});
        }
    }

  } catch (error) {
    await createLog(
      "webhooks/stripe/processCheckoutEvent",
      null,
      `Failed to process checkout event`,
      error
    );
    throw error;
  }
};

module.exports = {
    processCheckoutEvent,
};
