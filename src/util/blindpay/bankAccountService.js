const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { BlindpayBankAccountType } = require("./utils");

const BankTypeToTableMappings = {
    [BlindpayBankAccountType.PIX]: {
      table: "blindpay_pix_accounts",
      existConditions: ["pix_key"],
    },
    [BlindpayBankAccountType.ACH]: {
      table: "blindpay_ach_accounts",
      existConditions: ["routing_number", "account_number"]
    },
    [BlindpayBankAccountType.WIRE]: {
      table: "blindpay_wire_accounts",
      existConditions: ["routing_number", "account_number"]
    },
    [BlindpayBankAccountType.SPEI_BITSO]: {
      table: "blindpay_spei_bitso_accounts",
      existConditions: ["spei_institution_code", "spei_clabe"]
    },
    [BlindpayBankAccountType.TRANSFERS_BITSO]: {
      table: "blindpay_transfers_bitso_accounts",
      existConditions: ["transfers_type", "transfers_account"]
    },
    [BlindpayBankAccountType.ACH_COP_BITSO]: {
      table: "blindpay_ach_cop_bitso_accounts",
      existConditions: ["ach_cop_bank_code", "ach_cop_bank_account"]
    },
  };

const getBankAccountTableInfoFromAccountType = (bankAccountType) => {
  const mapping = BankTypeToTableMappings[bankAccountType];
  if (!mapping) throw new Error("Invalid bank account type"); // should never happen
  return mapping;
};

const getBankAccountByBlindpayId = async (
  blindpayAccountId,
  bankAccountType
) => {
  const { data, error } = await supabaseCall(() =>
    supabase
      .from("blindpay_bank_accounts")
      .select()
      .eq("blindpay_account_id", blindpayAccountId)
      .single()
  );

  if (error) throw error;
  return data;
};

const getBankAccountById = async (id, bankAccountType) => {
  const { data, error } = await supabaseCall(() =>
    supabase.from("blindpay_bank_accounts").select().eq("id", id).single()
  );

  if (error) throw error;
  return data;
};

const updateAccountInfoById = async (id, toUpdate) => {
  const { error } = await supabaseCall(() =>
    supabase.from("blindpay_accounts")
            .update(toUpdate)
            .eq("id", id));

  if (error) throw error;
};

const insertBankAccount = async (bankAccountInfo) => {

    const accountType = bankAccountInfo.type;
    const {table, existConditions} = getBankAccountTableInfoFromAccountType(accountType);

    const toInsertBankAccount = {
        type: accountType,
        name: bankAccountInfo.name,
        receiver_id: bankAccountInfo.receiver_id,
        user_id: bankAccountInfo.user_id,
        currency: bankAccountInfo.currency,
    }

    Object.keys(toInsertBankAccount).forEach(key => {
        delete bankAccountInfo[key];
    });

    const { data: bankAccountRecord, error: bankAccountRecordError } = await supabaseCall(() =>
        supabase.from(table)
                .insert(bankAccountInfo)
                .select()
                .single());

    if(bankAccountRecordError) throw bankAccountRecordError;

    toInsertBankAccount[`${accountType}_account_id`] = bankAccountRecord.id;

    const { data: accountRecord, error: accountRecordError } = await supabaseCall(() =>
        supabase.from("blindpay_accounts")
                .insert(toInsertBankAccount)
                .select(`*, bank_account_info: ${table}(*)`)
                .single());

    if(accountRecordError) throw accountRecordError;

    return accountRecord;
};

const getFullBankAccountInfoById = async (id, type) => {

    const { table } = getBankAccountTableInfoFromAccountType(type);

    const { data, error } = await supabaseCall(() =>
        supabase.from("blindpay_accounts")
                .select(`*, bank_account_info: ${table}(*)`)
                .eq("id", id)
                .eq("type", type)
                .single());

    if(error) throw error;

    return data;
}

module.exports = {
  getBankAccountByBlindpayId,
  getBankAccountById,
  updateAccountInfoById,
  getBankAccountTableInfoFromAccountType,
  insertBankAccount,
  getFullBankAccountInfoById
};
