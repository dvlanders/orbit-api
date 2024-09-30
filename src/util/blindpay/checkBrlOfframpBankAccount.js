const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { BlindpayBankAccountType } = require("./utils");

const checkBrlOfframpBankAccount = async (accountInfo) => {
  const type = accountInfo.type;

  let query = supabase
    .from("blindpay_bank_accounts")
    .select()
    .eq("user_id", accountInfo.user_id)
    .eq("receiver_id", accountInfo.receiver_id)
	  .not('global_account_id', 'is', null);
	
  if (type === BlindpayBankAccountType.PIX) {
    query = query.eq("pix_key", accountInfo.pix_key);
  } else if (type === BlindpayBankAccountType.ACH) {
    query = query
      .eq("routing_number", accountInfo.routing_number)
      .eq("account_number", accountInfo.account_number);
  } else if (type === BlindpayBankAccountType.WIRE) {
    query = query
      .eq("routing_number", accountInfo.routing_number)
      .eq("account_number", accountInfo.account_number);
  } else if ( type === BlindpayBankAccountType.SPEI_BITSO){
    query = query
      .eq("spei_institution_code", accountInfo.spei_institution_code)
      .eq("spei_clabe", accountInfo.spei_clabe);   
  } else if ( type === BlindpayBankAccountType.TRANSFERS_BITSO){
    query = query
      .eq("transfers_type", accountInfo.transfers_type)
      .eq("transfers_account", accountInfo.transfers_account);   
  } else if ( type === BlindpayBankAccountType.ACH_COP_BITSO){
    query = query
      .eq("ach_cop_bank_code", accountInfo.ach_cop_bank_code)
      .eq("ach_cop_bank_account", accountInfo.ach_cop_bank_account);   
  } else{
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
