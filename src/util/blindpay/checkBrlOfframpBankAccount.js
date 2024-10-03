const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { getBankAccountTableInfoFromAccountType } = require("./bankAccountService");

const checkBrlOfframpBankAccount = async (accountInfo) => {
  const type = accountInfo.type;
  const {table, existConditions} = getBankAccountTableInfoFromAccountType(type);
  let query = supabase
    .from("blindpay_accounts")
    .select(`*, bank_account_info: ${table}(*)`)
    .eq("user_id", accountInfo.user_id)
    .eq("receiver_id", accountInfo.receiver_id)
    .eq("type", type)
	  .not('global_account_id', 'is', null);

  existConditions.forEach(fields => {
    query = query.eq(`bank_account_info.${fields}`, accountInfo[fields]);
  });

  const { data: bankAccountRecord, error: bankAccountRecordError } =
    await supabaseCall(() => query.maybeSingle());

  if (bankAccountRecordError) throw bankAccountRecordError;

  return {
    bankAccountExist: !!bankAccountRecord,
    bankAccountRecord,
  };
};

module.exports = {
	checkBrlOfframpBankAccount,
};
