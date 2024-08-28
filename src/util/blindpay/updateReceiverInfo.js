const {
  receiverAcceptedFieldsMap,
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
const createLog = require("../logger/supabaseLogger");

const updateReceiverUBOInfo = async (userId, receiverId, fields) => {
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
      console.log("processed Ubos: \n", processedUbos);

      const { error: deleteError } = await supabaseCall(() =>
        supabase
          .from("blindpay_receivers_kyc_ubos")
          .delete()
          .eq("receiver_id", receiverId)
      );

      if (deleteError) {
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
      // Insert the new UBO data into the database
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
const updateReceiverKYCInfo = async (fields) => {
  const userId = fields.user_id;
  const receiver_id = fields.receiver_id;
  //Check if the receiver id is valid
  const { data: receiverExistRecord, error: receiverExistRecordError } =
    await supabaseCall(() =>
      supabase
        .from("blindpay_receivers_kyc")
        .select("type, kyc_type, blindpay_receiver_id")
        .eq("id", receiver_id)
        .eq("user_id", userId)
        .maybeSingle()
    );

  if (receiverExistRecordError) {
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

  if (!receiverExistRecord) {
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.RECORD_NOT_FOUND,
      404,
      "",
      {
        error: `Receiver not found`,
        receiver_id: receiver_id,
        user_id: userId,
      }
    );
  }
  console.log(receiverExistRecord);
  const acceptedFields =
    receiverAcceptedFieldsMap[receiverExistRecord.type]?.[
      receiverExistRecord.kyc_type
    ];

  if (!acceptedFields) {
    throw new ReceiverInfoUploadError(
      ReceiverInfoUploadErrorType.INTERNAL_ERROR,
      500,
      "",
      {
        error: `type or kyc_type is invalid`,
      }
    );
  }

  delete acceptedFields.type;
  delete acceptedFields.kyc_type;
  acceptedFields.receiver_id = "string";

  // check if required fields are uploaded and validate field values
  const { missingFields, invalidFields } = fieldsValidation(
    fields,
    [],
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

  if (fields.owners && fields.owners.length > 0) {
    fields.owners.map((owner) => {
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
    });
  }

  // Map fields to database columns
  const kycData = {};
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
          receiverExistRecord.type === "individual"
            ? "date_of_birth"
            : "formation_date",
        ],
      }
    );
  }

  console.log("kyc data: \n", kycData);

  // update the blindpay_receivers_kyc table record
  const { data: receiverRecord, error: receiverRecordError } =
    await supabaseCall(() =>
      supabase
        .from("blindpay_receivers_kyc")
        .update(kycData)
        .eq("id", receiver_id)
        .select()
        .single()
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

  receiverRecord.owners = await updateReceiverUBOInfo(
    userId,
    receiver_id,
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
  console.log("updated receiverRecord: \n", receiverRecord);
  // receiverRecord.blindpay_receiver_id =
  //   receiverExistRecord.blindpay_receiver_id;
  return receiverRecord;
};

module.exports = {
  updateReceiverKYCInfo,
};
