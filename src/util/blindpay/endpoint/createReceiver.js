const createLog = require("../../logger/supabaseLogger");
const { CreateReceiverErrorType, CreateReceiverError } = require("../errors");
const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

const ownerRequestBodyBuilder = async (ownerInfo) => {
  const ownersList = await Promise.all(
    ownerInfo.map(async (ubo) => {
      return {
        first_name: ubo.legal_first_name,
        last_name: ubo.legal_last_name,
        role: ubo.role,
        date_of_birth: ubo.date_of_birth,
        tax_id: ubo.tax_id,
        address_line_1: ubo.address_line_1,
        address_line_2: ubo.address_line_2,
        city: ubo.city,
        state_province_region: ubo.state_province_region,
        country: ubo.country,
        postal_code: ubo.postal_code,
        id_doc_country: ubo.id_doc_country,
        id_doc_type: ubo.id_doc_type,
        id_doc_front_file: ubo.id_doc_front_file,
        id_doc_back_file: ubo.id_doc_back_file,
        proof_of_address_doc_type: ubo.proof_of_address_doc_type,
        proof_of_address_doc_file: ubo.proof_of_address_doc_file,
      };
    })
  );

  return ownersList;
};

const individualReceiverRequestBodyBuilder = async (receiverInfo) => {
  const receiverRequestBody = {
    type: "individual",
    kyc_type: receiverInfo.kyc_type,
    first_name: receiverInfo.first_name,
    last_name: receiverInfo.last_name,
    date_of_birth: receiverInfo.date_of_birth,
    email: receiverInfo.email,
    country: receiverInfo.country,
  };

  if (receiverInfo.kyc_type === "standard") {
    const extraBody = {
      tax_id: receiverInfo.tax_id,
      ip_address: receiverInfo.ip_address,
      address_line_1: receiverInfo.address_line_1,
      city: receiverInfo.city,
      state_province_region: receiverInfo.state_province_region,
      postal_code: receiverInfo.postal_code,
      id_doc_country: receiverInfo.id_doc_country,
      id_doc_type: receiverInfo.id_doc_type,
      id_doc_front_file: receiverInfo.id_doc_front_file,
    };

    const optionalFields = [
      "phone_number",
      "address_line_2",
      "id_doc_back_file",
      "proof_of_address_doc_type",
      "proof_of_address_doc_file",
    ];
    optionalFields.forEach((field) => {
      if (receiverInfo[field]) {
        extraBody[field] = receiverInfo[field];
      }
    });

    Object.assign(receiverRequestBody, extraBody);
  }

  return receiverRequestBody;
};

const businessReceiverRequestBodyBuilder = async (receiverInfo) => {
  const receiverRequestBody = {
    type: "business",
    kyc_type: receiverInfo.kyc_type,
    legal_name: receiverInfo.legal_name,
    tax_id: receiverInfo.tax_id,
    formation_date: receiverInfo.formation_date,
    email: receiverInfo.email,
    country: receiverInfo.country,
  };

  if (receiverInfo.kyc_type === "standard") {
    const extraBody = {
      ip_address: receiverInfo.ip_address,
      address_line_1: receiverInfo.address_line_1,
      city: receiverInfo.city,
      state_province_region: receiverInfo.state_province_region,
      postal_code: receiverInfo.postal_code,
      owners: await ownerRequestBodyBuilder(receiverInfo.owners),
      incorporation_doc_file: receiverInfo.incorporation_doc_file,
      proof_of_ownership_doc_file: receiverInfo.proof_of_ownership_doc_file,
    };

    const optionalFields = [
      "website",
      "address_line_2",
      "proof_of_address_doc_type",
      "proof_of_address_doc_file",
    ];
    optionalFields.forEach((field) => {
      if (receiverInfo[field]) {
        extraBody[field] = receiverInfo[field];
      }
    });

    Object.assign(receiverRequestBody, extraBody);
  }

  return receiverRequestBody;
};

const createReceiver = async (receiverInfo) => {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.BLINDPAY_API_KEY}`,
    "Content-Type": "application/json",
  };

  const receiverRequestBody =
    receiverInfo.type === "individual"
      ? await individualReceiverRequestBodyBuilder(receiverInfo)
      : await businessReceiverRequestBodyBuilder(receiverInfo);

  console.log("receiverRequestBody: \n", receiverRequestBody);
  const response = await fetch(
    `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/receivers`,
    {
      method: "POST",
      headers: headers,
      body: JSON.stringify(receiverRequestBody),
    }
  );

  const responseBody = await response.json();
  console.log(responseBody);
  if (!response.ok) {
    // Insert response into blindpay_receivers table
    const { error } = await supabase
      .from("blindpay_receivers_kyc")
      .update({
        blindpay_response: response,
        kyc_status: "inactive",
      })
      .eq("id", receiverInfo.id);

    throw new CreateReceiverError(
      CreateReceiverErrorType.INTERNAL_ERROR,
      responseBody
    );
  }

  return responseBody;
};

module.exports = {
  createReceiver,
};
