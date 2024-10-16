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
    [BlindpayBankAccountType.SPEI]: {
      table: "blindpay_spei_bitso_accounts",
      existConditions: ["spei_institution_code", "spei_clabe"]
    },
    [BlindpayBankAccountType.TRANSFERS]: {
      table: "blindpay_transfers_bitso_accounts",
      existConditions: ["transfers_type", "transfers_account"]
    },
    [BlindpayBankAccountType.ACH_COP]: {
      table: "blindpay_ach_cop_bitso_accounts",
      existConditions: ["ach_cop_bank_code", "ach_cop_bank_account"]
    },
  };

const getBankAccountTableInfoFromAccountType = (bankAccountType) => {
  const mapping = BankTypeToTableMappings[bankAccountType];
  if (!mapping) throw new Error("Invalid bank account type"); // should never happen
  return mapping;
};

const updateAccountInfoById = async (id, type, toUpdate) => {
  const { table } = getBankAccountTableInfoFromAccountType(type);
  const { error } = await supabaseCall(() =>
    supabase.from(table)
            .update(toUpdate)
            .eq("id", id));

  if (error) throw error;
};

const insertBankAccount = async (bankAccountInfo) => {

    const accountType = bankAccountInfo.type;
    const {table, existConditions} = getBankAccountTableInfoFromAccountType(accountType);

    const { data: bankAccountRecord, error: bankAccountRecordError } = await supabaseCall(() =>
        supabase.from(table)
                .insert(bankAccountInfo)
                .select()
                .single());

    if(bankAccountRecordError) throw bankAccountRecordError;

    return bankAccountRecord;
};

const getBankAccountInfoById = async (id, type) => {

  const { table } = getBankAccountTableInfoFromAccountType(type);

  const { data, error } = await supabaseCall(() =>
      supabase.from(table)
              .select()
              .eq("id", id)
              .eq("type", type)
              .maybeSingle());

  if(error) throw error;

  return data;
}

const getBankAccountInfoByGlobalId = async (id, type) => {

  const { table } = getBankAccountTableInfoFromAccountType(type);

  const { data, error } = await supabaseCall(() =>
      supabase.from(table)
              .select()
              .eq("global_account_id", id)
              .eq("type", type)
              .maybeSingle());

  if(error) throw error;

  return data;
}

module.exports = {
  updateAccountInfoById,
  getBankAccountTableInfoFromAccountType,
  insertBankAccount,
  getBankAccountInfoById,
  getBankAccountInfoByGlobalId
};
