const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { filterBankAccountInfo } = require("../../../blindpay/getBankAccountInfo");

const fetchBlindpayAccount = async (currency, profileId, accountId) => {
  const { data: bankInfo, error } = await supabaseCall(() =>
    supabase
      .from("blindpay_bank_accounts")
      .select()
      .eq("id", accountId)
      .eq("currency", currency)
      .single()
  );

  if (error) throw error;

  if (accountId && !bankInfo) return null;
  if (bankInfo) {
    return filterBankAccountInfo(bankInfo.type, bankInfo);
  }
  return null;
};

module.exports = fetchBlindpayAccount;
