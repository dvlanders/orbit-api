const {
  receiverAcceptedFieldsMap,
  receiverRequiredFieldsMap,
  receiverFieldsNameMap,
  ownerRequiredFields,
  ownerAcceptedFields,
} = require("./utils");
const {
  ReceiverInfoUploadErrorType,
  ReceiverInfoUploadError,
} = require("./errors");
const { fieldsValidation } = require("../common/fieldsValidation");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { v4: uuidv4 } = require("uuid");
const createLog = require("../logger/supabaseLogger");
const { filesValidation } = require("./fileValidation");

const uploadReceiverUBOInfo = async (userId, receiverId, fields) => {
  if (fields.owners && fields.owners.length > 0) {
    const { owners } = fields;

    // Process each UBO
    try {
      const processedUbos = await Promise.all(
        owners.map(async (owner, index) => {
          const ownerData = { receiver_id: receiverId };
          Object.keys(owner).forEach((field) => {
            const column = receiverFieldsNameMap[field];
            if (column && owner[field] !== undefined) {
              ownerData[column] = owner[field];
            }
          });
          try {
            if (ownerData.date_of_birth) {
              ownerData.date_of_birth = new Date(
                ownerData.date_of_birth
              ).toISOString();
            }
          } catch (error) {
            throw new ReceiverInfoUploadError(
              ReceiverInfoUploadErrorType.INVALID_FIELD,
              400,
              "",
              {
                error: `owners field provided are either missing or invalid`,
                missing_fields: [],
                invalid_fields: ["date_of_birth"],
              }
            );
          }

          return ownerData;
        })
      );
      // console.log("processed Ubos: \n", processedUbos);
      // Insert the processed UBO data into the database
      const {
        data: ultimateBeneficialOwnersData,
        error: ultimateBeneficialOwnersError,
      } = await supabaseCall(() =>
        supabase
          .from("blindpay_receivers_kyc_ubos")
          .insert(processedUbos)
          .select()
      );

      if (ultimateBeneficialOwnersError) {
        // Handle the error
        console.error(ultimateBeneficialOwnersError);
        throw new ReceiverInfoUploadError(
          ReceiverInfoUploadErrorType.INTERNAL_ERROR,
          500,
          "Error inserting UBO data",
          { error: ultimateBeneficialOwnersError.message }
        );
      }

      const reformattedUBOsData = ultimateBeneficialOwnersData.map((item) => {
        return {
          ...item,
          date_of_birth: new Date(item.date_of_birth).toISOString(),
        };
      });

      return reformattedUBOsData;
    } catch (error) {
      await createLog(
        "blindpay/createReceiver/uploadReceiverUBOInfo",
        userId,
        error.message,
        error
      );
      if (error instanceof ReceiverInfoUploadError) throw error;

      // internal server error
      throw new ReceiverInfoUploadError(
        ReceiverInfoUploadErrorType.INTERNAL_ERROR,
        500,
        "",
        {
          error:
            "Unexpected error happened, please contact HIFI for more information",
        }
      );
    }
  }
};
const uploadReceiverKYCInfo = async (fields) => {
  if (!fields.type || !fields.kyc_type) {
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.FIELD_MISSING,
      400,
      "",
      {
        error: `type or kyc_type is missing`,
      }
    );
  }
  const userId = fields.user_id;

  // get the required and accepted fields for the provided type and kyc_type
  const requiredFields =
    receiverRequiredFieldsMap[fields.type]?.[fields.kyc_type];
  const acceptedFields =
    receiverAcceptedFieldsMap[fields.type]?.[fields.kyc_type];

  if (!requiredFields || !acceptedFields) {
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.INVALID_FIELD,
      400,
      "",
      {
        error: `type or kyc_type is invalid`,
      }
    );
  }

  // validate all fields
  const { missingFields, invalidFields } = fieldsValidation(
    fields,
    requiredFields,
    acceptedFields
  );
  if (missingFields.length > 0 || invalidFields.length > 0) {
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.INVALID_FIELD,
      400,
      "",
      {
        error: `fields provided are either missing or invalid`,
        missing_fields: missingFields,
        invalid_fields: invalidFields,
      }
    );
  }

  if (fields.kyc_type === "standard" && fields.type === "individual" && fields.country !== fields.id_doc_country) {
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.INVALID_FIELD,
      400,
      "",
      {
        error: `country and id_doc_country must be the same for individual standard KYC`,
        missing_fields: [],
        invalid_fields: ["country", "id_doc_country"],
      }
    );
  }

  const invalidFiles = await filesValidation(fields);
  if (invalidFiles.length > 0) {
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.INVALID_FIELD,
      400,
      "",
      {
        error: `INVALID_FILES`,
        invalidFiles: invalidFiles,
      }
    );
  }

  // validate owners fields for standard KYC business type
  if (fields.owners && fields.owners.length > 0) {
    await Promise.all(fields.owners.map(async (owner) => {
      const { missingFields, invalidFields } = fieldsValidation(
        owner,
        ownerRequiredFields,
        ownerAcceptedFields
      );
      if (missingFields.length > 0 || invalidFields.length > 0) {
        throw new ReceiverInfoUploadError(
          ReceiverInfoUploadErrorType.INVALID_FIELD,
          400,
          "",
          {
            error: `owners field provided are either missing or invalid`,
            missing_fields: missingFields,
            invalid_fields: invalidFields,
          }
        );
      }
  
      const invalidFiles = await filesValidation(owner);
      if (invalidFiles.length > 0) {
        throw new ReceiverInfoUploadError(
          ReceiverInfoUploadErrorType.INVALID_FIELD,
          400,
          "",
          {
            error: `INVALID_FILES`,
            invalid_files: invalidFiles,
          }
        );
      }
    }));
  }

  const receiver_id = uuidv4();

  // Map fields to database columns
  const kycData = { id: receiver_id };
  Object.keys(fields).forEach((field) => {
    const column = receiverFieldsNameMap[field];
    if (column && fields[field] !== undefined) {
      kycData[column] = fields[field];
    }
  });

  try {
    if (kycData.date_of_birth) {
      kycData.date_of_birth = new Date(kycData.date_of_birth).toISOString();
    }
    if (kycData.formation_date) {
      kycData.formation_date = new Date(kycData.formation_date).toISOString();
    }
  } catch (error) {
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.INVALID_FIELD,
      400,
      "",
      {
        error: `fields provided are either missing or invalid`,
        missing_fields: [],
        invalid_fields: [
          fields.type === "individual" ? "date_of_birth" : "formation_date",
        ],
      }
    );
  }

  // console.log("kyc data: \n", kycData);

  // update the blindpay_receivers_kyc table record
  const { data: receiverRecord, error: receiverRecordError } =
    await supabaseCall(() =>
      supabase.from("blindpay_receivers_kyc").insert(kycData).select().single()
    );

  if (receiverRecordError) {
    await createLog(
      "blindpay/createReceiver/uploadReceiverKYCInfo",
      userId,
      receiverRecordError.message,
      receiverRecordError
    );
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.INTERNAL_ERROR,
      500,
      "",
      {
        error:
          "Unexpected error happened, please contact HIFI for more information",
      }
    );
  }

  receiverRecord.owners = await uploadReceiverUBOInfo(
    userId,
    receiverRecord.id,
    fields
  );
  if (receiverRecord.date_of_birth) {
    receiverRecord.date_of_birth = new Date(
      receiverRecord.date_of_birth
    ).toISOString();
  }
  if (receiverRecord.formation_date) {
    receiverRecord.formation_date = new Date(
      receiverRecord.formation_date
    ).toISOString();
  }
  return receiverRecord;
};

module.exports = {
  uploadReceiverKYCInfo,
};
