const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const selectFields = `
	id, 
	created_at,
	name,
  currency,
  bank_country,
  pix_key,
  receiver_id,
  user_id
`;

const filledInfo = (blindpayAccountData) => {
  const resObject = {
    accountId: blindpayAccountData.id,
    createdAt: blindpayAccountData.created_at,
    name: blindpayAccountData.name,
    currency: blindpayAccountData.currency,
    bankCountry: blindpayAccountData.bank_country,
    pixKey: blindpayAccountData.pix_key,
    receiverId: blindpayAccountData.receiver_id,
    userId: blindpayAccountData.user_id,
  };

  return resObject;
};

const fetchBlindpayAccount = async (
  currency,
  profileId,
  accountId,
  userId,
  limit = 10,
  createdAfter = new Date("1900-01-01").toISOString(),
  createdBefore = new Date("2200-01-01").toISOString()
) => {
  let allBanksInfo;
  let bankInfo;

  if (!accountId) {
    if (userId) {
      // fetch all record of an user
      let { data: blindpayAccountData, error: blindpayAccountError } =
        await supabaseCall(() =>
          supabase
            .from("blindpay_accounts")
            .select(selectFields)
            .eq("currency", currency)
            .eq("user_id", userId)
            .lt("created_at", createdBefore)
            .gt("created_at", createdAfter)
            .order("created_at", { ascending: false })
            .limit(limit)
        );
      if (blindpayAccountError) throw blindpayAccountError;
      allBanksInfo = blindpayAccountData;
    } else {
      // fetch all records of an org
      let { data: blindpayAccountData, error: blindpayAccountError } =
        await supabaseCall(() =>
          supabase
            .from("blindpay_accounts")
            .select(`users: user_id!inner(id, profile_id), ${selectFields}`)
            .eq("currency", currency)
            .eq("users.profile_id", profileId)
            .lt("created_at", createdBefore)
            .gt("created_at", createdAfter)
            .order("created_at", { ascending: false })
            .limit(limit)
        );
      if (blindpayAccountError) throw blindpayAccountError;
      allBanksInfo = blindpayAccountData;
    }
  } else {
    // fetch single record
    let { data: blindpayAccountData, error: blindpayAccountError } =
      await supabaseCall(() =>
        supabase
          .from("blindpay_accounts")
          .select(selectFields)
          .eq("id", accountId)
          .eq("currency", currency)
          .maybeSingle()
      );
    if (blindpayAccountError) throw blindpayAccountError;
    bankInfo = blindpayAccountData;
  }

  if (accountId && !bankInfo) return null;
  if (bankInfo) {
    return filledInfo(bankInfo);
  } else if (allBanksInfo) {
    return {
      count: allBanksInfo.length,
      banks: allBanksInfo.map((bank) => filledInfo(bank)),
    };
  }

  return null;
};

module.exports = fetchBlindpayAccount;
