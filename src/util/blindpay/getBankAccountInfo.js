const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { BlindpayBankAccountType } = require("./utils");
const { getBankAccountInfoById } = require("./bankAccountService");

const filterBankAccountInfo = (type, bankAccountInfo) => {
  type = bankAccountInfo.type;
  const filteredBankAccountInfo = {
      accountId: bankAccountInfo.global_account_id,
      userId: bankAccountInfo.user_id,
      receiverId: bankAccountInfo.receiver_id,
      type: bankAccountInfo.type,
      name: bankAccountInfo.name,
    };
  
  if(type == BlindpayBankAccountType.PIX){
      filteredBankAccountInfo.pix_key = bankAccountInfo.pix_key;
  }else if(type == BlindpayBankAccountType.ACH){
      const extraBody = {
          beneficiary_name: bankAccountInfo.beneficiary_name,
          routing_number: bankAccountInfo.routing_number,
          account_number: bankAccountInfo.account_number,
          account_type: bankAccountInfo.account_type,
          account_class: bankAccountInfo.account_class,
        };
        Object.assign(filteredBankAccountInfo, extraBody);
  }else if(type == BlindpayBankAccountType.WIRE){
      const extraBody = {
          beneficiary_name: bankAccountInfo.beneficiary_name,
          routing_number: bankAccountInfo.routing_number,
          account_number: bankAccountInfo.account_number,
          address_line_1: bankAccountInfo.address_line_1,
          address_line_2: bankAccountInfo.address_line_2,
          city: bankAccountInfo.city,
          state_province_region: bankAccountInfo.state_province_region,
          country: bankAccountInfo.country,
          postal_code: bankAccountInfo.postal_code,
        };
        Object.assign(filteredBankAccountInfo, extraBody);
  } else if (type === BlindpayBankAccountType.SPEI) {
      const extraBody = {
        spei_protocol: bankAccountInfo.spei_protocol,
        spei_institution_code: bankAccountInfo.spei_institution_code,
        spei_clabe: bankAccountInfo.spei_clabe,
        beneficiary_name: bankAccountInfo.beneficiary_name,
      };
      Object.assign(filteredBankAccountInfo, extraBody);
  
    } else if (type === BlindpayBankAccountType.TRANSFERS) {
      const extraBody = {
        transfers_type: bankAccountInfo.transfers_type,
        transfers_account: bankAccountInfo.transfers_account,
        beneficiary_name: bankAccountInfo.beneficiary_name,
      };
      Object.assign(filteredBankAccountInfo, extraBody);
  
    } else if (type === BlindpayBankAccountType.ACH_COP) {
      const extraBody = {
        account_type: bankAccountInfo.account_type,
        ach_cop_beneficiary_first_name: bankAccountInfo.ach_cop_beneficiary_first_name,
        ach_cop_beneficiary_last_name: bankAccountInfo.ach_cop_beneficiary_last_name,
        ach_cop_document_id: bankAccountInfo.ach_cop_document_id,
        ach_cop_document_type: bankAccountInfo.ach_cop_document_type,
        ach_cop_email: bankAccountInfo.ach_cop_email,
        ach_cop_bank_code: bankAccountInfo.ach_cop_bank_code,
        ach_cop_bank_account: bankAccountInfo.ach_cop_bank_account,
      };
      Object.assign(filteredBankAccountInfo, extraBody);
  
    } else{
      throw new Error("Invalid bank account type to filter");
  }

  return filteredBankAccountInfo;
}

const getBankAccountInfo = async (accountId, type) => {
    const bankAccountInfo = await getBankAccountInfoById(accountId, type);
    if(!bankAccountInfo) return null;
    return filterBankAccountInfo(bankAccountInfo.type, bankAccountInfo);
}

module.exports = {
    getBankAccountInfo,
    filterBankAccountInfo
  };
  