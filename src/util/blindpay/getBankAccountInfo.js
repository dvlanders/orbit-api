const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const filterBankAccountInfo = (type, bankAccountInfo) => {
    if (!type) return bankAccountInfo;
    const filteredBankAccountInfo = {
        id: bankAccountInfo.global_account_id,
        type: bankAccountInfo.type,
        name: bankAccountInfo.name,
      };
    
    if(type == "pix"){
        filteredBankAccountInfo.pix_key = bankAccountInfo.pix_key;
    }else if(type == "ach"){
        const extraBody = {
            beneficiary_name: bankAccountInfo.beneficiary_name,
            routing_number: bankAccountInfo.routing_number,
            account_number: bankAccountInfo.account_number,
            account_type: bankAccountInfo.account_type,
            account_class: bankAccountInfo.account_class,
          };
          Object.assign(filteredBankAccountInfo, extraBody);
    }else if(type == "wire"){
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
    }else{
        throw new Error("Invalid bank account type to filter");
    }

    return filteredBankAccountInfo;
}

const getBankAccountInfo = async (blindpayAccountId) => {

    const {data, error} = await supabaseCall(() => supabase
        .from('blindpay_bank_accounts')
        .select()
        .eq('blindpay_account_id', blindpayAccountId)
        .single()
    );

    if(error)throw error;
    return filterBankAccountInfo(data.type, data);
}

module.exports = {
    getBankAccountInfo,
  };
  