const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const blindpayRailCheck = async (bankAccountId) => {
  // check if the destination user own the Blindpay bank account
  let { data: blindpayAccountData, error: blindpayAccountError } =
    await supabaseCall(() =>
      supabase
        .from("blindpay_bank_accounts")
        .select("blindpay_account_id, user_id")
        .eq("id", bankAccountId)
        .maybeSingle()
    );
  if (blindpayAccountError) throw blindpayAccountError;
  if (!blindpayAccountData || !blindpayAccountData.blindpay_account_id)
    return { isExternalAccountExist: false, blindpayAccountId: null };

  return {
    isExternalAccountExist: true,
    blindpayAccountId: blindpayAccountData.blindpay_account_id,
    destinationUserId: blindpayAccountData.user_id,
  };
};

module.exports = blindpayRailCheck;
