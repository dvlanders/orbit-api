const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { getBankAccountInfo } = require("../../../blindpay/getBankAccountInfo");

const fetchBlindpayAccount = async (currency, profileId, accountId) => {
  return await getBankAccountInfo(accountId);
};

module.exports = fetchBlindpayAccount;
