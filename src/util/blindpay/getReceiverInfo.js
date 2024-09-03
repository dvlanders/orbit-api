const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { ReceiverInfoGetErrorType, ReceiverInfoGetError } = require("./errors");
const { receiverAcceptedFieldsMap, receiverFieldsNameMap } = require("./utils");

const filterReceiverInfo = (receiverInfo) => {
  const acceptedFields =
    receiverAcceptedFieldsMap[receiverInfo.type]?.[receiverInfo.kyc_type];

  acceptedFields.kyc_status = "string";
  const keepFields = {
    id: receiverInfo.id,
    created_at: receiverInfo.created_at,
    limit: receiverInfo.blindpay_response?.limit
  };
  Object.keys(acceptedFields).map((field) => {
    const colName = receiverFieldsNameMap[field];
    if (colName && receiverInfo[colName] !== undefined) {
      keepFields[colName] = receiverInfo[colName];
    }
  });
  return keepFields;
};

const getReceiverInfo = async (userId, receiverId) => {
  if (!receiverId) {
    const { data: receiversInfo, error: receiversInfoError } =
      await supabaseCall(() =>
        supabase.from("blindpay_receivers_kyc").select().eq("user_id", userId)
      );

    if (receiversInfoError) {
      throw new ReceiverInfoGetError(
        ReceiverInfoGetErrorType.INTERNAL_ERROR,
        500,
        "",
        {
          error: `Error fetching receiver info`,
          receiver_id: receiverId,
          user_id: userId,
        }
      );
    }

    if (
      receiversInfo.type === "business" &&
      receiversInfo.kyc_type == "standard"
    ) {
      // Insert the processed UBO data into the database
      const { data: ownersData, error: ownersDataError } = await supabaseCall(
        () =>
          supabase
            .from("blindpay_receivers_kyc_ubos")
            .select()
            .eq("receiver_id", receiversInfo.id)
      );

      if (ownersDataError) {
        throw new ReceiverInfoGetError(
          ReceiverInfoGetErrorType.INTERNAL_ERROR,
          500,
          "",
          {
            error: `Error fetching owners info`,
            receiver_id: receiverId,
            user_id: userId,
          }
        );
      }

      const formattedOwnersData = ownersData.map((item) => {
        return {
          first_name: item.first_name,
          last_name: item.last_name,
          role: item.role,
          date_of_birth: new Date(item.date_of_birth).toISOString(),
          tax_id: item.tax_id,
          address_line_1: item.address_line_1,
          address_line_2: item.address_line_2,
          city: item.city,
          state_province_region: item.state_province_region,
          country: item.country,
          postal_code: item.postal_code,
          id_doc_country: item.id_doc_country,
          id_doc_type: item.id_doc_type,
          id_doc_front_file: ubo.id_doc_front_file,
          id_doc_back_file: ubo.id_doc_back_file,
          proof_of_address_doc_type: ubo.proof_of_address_doc_type,
          proof_of_address_doc_file: ubo.proof_of_address_doc_file,
        };
      });

      receiversInfo.owners = formattedOwnersData;
    }

    return {
      count: receiversInfo.length,
      data: receiversInfo.map((receiverInfo) =>
        filterReceiverInfo(receiverInfo)
      ),
    };
  } else {
    const { data: receiverInfo, error: receiverInfoError } = await supabaseCall(
      () =>
        supabase
          .from("blindpay_receivers_kyc")
          .select()
          .eq("id", receiverId)
          .eq("user_id", userId)
          .maybeSingle()
    );

    if (receiverInfoError) {
      throw new ReceiverInfoGetError(
        ReceiverInfoGetErrorType.INTERNAL_ERROR,
        500,
        "",
        {
          error: `Error fetching receiver info`,
          receiver_id: receiverId,
          user_id: userId,
        }
      );
    }

    if (!receiverInfo) {
      throw new ReceiverInfoGetError(
        ReceiverInfoGetErrorType.NOT_FOUND,
        404,
        "",
        {
          error: `Receiver not found`,
          receiver_id: receiverId,
          user_id: userId,
        }
      );
    }

    return {
      count: 1,
      data: [filterReceiverInfo(receiverInfo)],
    };
  }
};

module.exports = {
  getReceiverInfo,
};
