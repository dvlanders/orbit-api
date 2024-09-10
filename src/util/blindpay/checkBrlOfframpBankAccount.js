const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const checkBrlOfframpBankAccount = async (accountInfo) => {
  const type = accountInfo.type;

  let query = supabase
    .from("blindpay_bank_accounts")
    .select()
    .eq("user_id", accountInfo.user_id)
    .eq("receiver_id", accountInfo.receiver_id)
	.not('global_account_id', 'is', null);
	
  if (type === "pix") {
    query = query.eq("pix_key", accountInfo.pix_key);
  } else if (type === "ach") {
    query = query
      .eq("routing_number", accountInfo.routing_number)
      .eq("account_number", accountInfo.account_number);
  } else if (type === "wire") {
    query = query
      .eq("routing_number", accountInfo.routing_number)
      .eq("account_number", accountInfo.account_number);
  }else{
	throw new Error("Invalid account type");
  }

  const { data: bankAccountRecord, error: bankAccountRecordError } =
    await supabaseCall(() => query.maybeSingle());

  if (bankAccountRecordError) throw bankAccountRecordError;

  if (bankAccountRecord) {
    return {
      bankAccountExist: true,
      bankAccountRecord,
    };
  }

  return { bankAccountExist: false, bankAccountRecord};
};

module.exports = {
	checkBrlOfframpBankAccount,
};
