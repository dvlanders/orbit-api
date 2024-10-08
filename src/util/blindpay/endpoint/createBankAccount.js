const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient");
const {
  CreateBankAccountErrorType,
  CreateBankAccountError,
} = require("../errors");
const { BlindpayBankAccountType } = require("../utils");
const { updateAccountInfoById } = require("../bankAccountService");

const bankAccountRequestBodyBuilder = async (bankAccountInfo) => {

  const bankAccountRequestBody = {
    type: bankAccountInfo.type,
    name: bankAccountInfo.name,
  };

  if (bankAccountInfo.type === BlindpayBankAccountType.PIX) {
    bankAccountRequestBody.pix_key = bankAccountInfo.pix_key;
  } else if (bankAccountInfo.type === BlindpayBankAccountType.ACH) {
    const extraBody = {
      beneficiary_name: bankAccountInfo.beneficiary_name,
      routing_number: bankAccountInfo.routing_number,
      account_number: bankAccountInfo.account_number,
      account_type: bankAccountInfo.account_type,
      account_class: bankAccountInfo.account_class,
    };
    Object.assign(bankAccountRequestBody, extraBody);
  } else if (bankAccountInfo.type === BlindpayBankAccountType.WIRE) {
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
    Object.assign(bankAccountRequestBody, extraBody);
  } else if (bankAccountInfo.type === BlindpayBankAccountType.SPEI_BITSO) {
    const extraBody = {
      spei_protocol: bankAccountInfo.spei_protocol,
      spei_institution_code: bankAccountInfo.spei_institution_code,
      spei_clabe: bankAccountInfo.spei_clabe,
      beneficiary_name: bankAccountInfo.beneficiary_name,
    };
    Object.assign(bankAccountRequestBody, extraBody);

  } else if (bankAccountInfo.type === BlindpayBankAccountType.TRANSFERS_BITSO) {
    const extraBody = {
      transfers_type: bankAccountInfo.transfers_type,
      transfers_account: bankAccountInfo.transfers_account,
      beneficiary_name: bankAccountInfo.beneficiary_name,
    };
    Object.assign(bankAccountRequestBody, extraBody);

  }else if (bankAccountInfo.type === BlindpayBankAccountType.ACH_COP_BITSO) {
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
    Object.assign(bankAccountRequestBody, extraBody);

  }

  return bankAccountRequestBody;
};

const createBankAccount = async (bankAccountInfo) => {
  const receiverId = bankAccountInfo.blindpay_receiver_id;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.BLINDPAY_API_KEY}`,
    "Content-Type": "application/json",
  };

  const requestBody = await bankAccountRequestBodyBuilder(bankAccountInfo);

  const url = `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/receivers/${receiverId}/bank-accounts`;

  let response, responseBody;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });
    responseBody = await response.json();
  } catch (error) {
    throw new CreateBankAccountError(
      CreateBankAccountErrorType.INTERNAL_ERROR,
      500,
      "Blindpay API create bank account fetch error or parsing error",
      error
    );
  }

  // console.log(responseBody);
  if (!response.ok) {
    await updateAccountInfoById(bankAccountInfo.id, bankAccountInfo.type, { blindpay_response: responseBody });

    if (responseBody.message === "kyc_type_not_supported") {
      throw new CreateBankAccountError(
        CreateBankAccountErrorType.KYC_TYPE_NOT_SUPPORTED,
        400,
        "",
        {
          error:
            "Bank account type is not supported by the receiver's kyc type.",
        }
      );
    } else if (responseBody.message === "create_ach_failed") {
      throw new CreateBankAccountError(
        CreateBankAccountErrorType.INTERNAL_ERROR,
        500,
        responseBody.message,
        responseBody
      );
    }

    throw new CreateBankAccountError(
      CreateBankAccountErrorType.INTERNAL_ERROR,
      500,
      responseBody
    );
  }

  return responseBody;
};

module.exports = {
  createBankAccount,
};
