const {
  bankAccountAcceptedFieldsMap,
  bankAccountRequiredFieldsMap,
  bankAccountFieldsNameMap,
} = require("./utils");
const {
  BankAccountInfoUploadErrorType,
  BankAccountInfoUploadError,
} = require("./errors");
const { fieldsValidation } = require("../common/fieldsValidation");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { checkBrlOfframpBankAccount } = require("./checkBrlOfframpBankAccount");

const uploadBankAccountInfo = async (fields) => {
  const acceptedFields = bankAccountAcceptedFieldsMap[fields.type];
  const requiredFields = bankAccountRequiredFieldsMap[fields.type];

  if (!requiredFields || !acceptedFields) {
    throw new BankAccountInfoUploadError(
      BankAccountInfoUploadErrorType.INVALID_FIELD,
      400,
      "",
      {
        error: `type is invalid`,
      }
    );
  }
  // check if required fields are uploaded and validate field values
  const { missingFields, invalidFields } = fieldsValidation(
    fields,
    requiredFields,
    acceptedFields
  );
  if (missingFields.length > 0 || invalidFields.length > 0) {
    throw new BankAccountInfoUploadError(
      BankAccountInfoUploadErrorType.INVALID_FIELD,
      400,
      "",
      {
        error: `fields provided are either missing or invalid`,
        missing_fields: missingFields,
        invalid_fields: invalidFields,
      }
    );
  }

  //Check if the receiver id is valid
  const { data: receiverRecord, error: receiverRecordError } =
    await supabaseCall(() =>
      supabase
        .from("blindpay_receivers_kyc")
        .select("blindpay_receiver_id, kyc_status")
        .eq("id", fields.receiver_id)
        .eq("user_id", fields.user_id)
        .maybeSingle()
    );

  if (receiverRecordError) {
    throw new BankAccountInfoUploadError(
      BankAccountInfoUploadErrorType.INTERNAL_ERROR,
      500,
      "",
      {
        error:
          "Unexpected error happened, please contact HIFI for more information",
      }
    );
  }

  if (!receiverRecord) {
    throw new BankAccountInfoUploadError(
      BankAccountInfoUploadErrorType.RECORD_NOT_FOUND,
      404,
      "",
      {
        error: "Receiver record not found",
      }
    );
  }

  if (receiverRecord && receiverRecord.kyc_status !== "approved") {
    throw new BankAccountInfoUploadError(
      BankAccountInfoUploadErrorType.KYC_STATUS_NOT_APPROVED,
      400,
      "",
      {
        error: "KYC status not approved",
      }
    );
  }

  const bankAccountData = {
    user_id: fields.user_id,
    receiver_id: fields.receiver_id,
  };
  Object.keys(fields).forEach((field) => {
    const column = bankAccountFieldsNameMap[field];
    if (column && fields[field] !== undefined) {
      bankAccountData[column] = fields[field];
    }
  });

  // console.log("bank account data: \n", bankAccountData);

  // check if the bank account already exists
  const { bankAccountExist, bankAccountRecord: existingBankAccountRecord } = await checkBrlOfframpBankAccount(bankAccountData);
  if(bankAccountExist) {
    return { bankAccountExist, bankAccountRecord: existingBankAccountRecord };
  }

  // update the blindpay_bank_accounts table record
  const { data: bankAccountRecord, error: bankAccountRecordError } =
    await supabaseCall(() =>
      supabase
        .from("blindpay_bank_accounts")
        .insert(bankAccountData)
        .select()
        .single()
    );

  if (bankAccountRecordError) {
    throw new BankAccountInfoUploadError(
      BankAccountInfoUploadErrorType.INTERNAL_ERROR,
      500,
      "",
      {
        error:
          "Unexpected error happened, please contact HIFI for more information",
      }
    );
  }

  bankAccountRecord.blindpay_receiver_id = receiverRecord.blindpay_receiver_id;
  return { bankAccountExist: false, bankAccountRecord };
};

module.exports = {
  uploadBankAccountInfo,
};
