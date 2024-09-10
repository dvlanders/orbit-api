const lightKYC = {
  requiredFields: [
    "type",
    "user_id",
    "kyc_type",
    "first_name",
    "last_name",
    "date_of_birth",
    "email",
    "country",
  ],
  acceptedFields: {
    type: "string",
    user_id: "string",
    kyc_type: "string",
    first_name: "string",
    last_name: "string",
    date_of_birth: "string",
    email: "string",
    country: "string",
  },
};

const lightKYB = {
  requiredFields: [
    "type",
    "user_id",
    "kyc_type",
    "legal_name",
    "tax_id",
    "formation_date",
    "email",
    "country",
  ],
  acceptedFields: {
    type: "string",
    user_id: "string",
    kyc_type: "string",
    legal_name: "string",
    tax_id: "string",
    formation_date: "string",
    email: "string",
    country: "string",
  },
};

const standardKYC = {
  requiredFields: [
    ...lightKYC.requiredFields,
    "tax_id",
    "ip_address",
    "address_line_1",
    "city",
    "state_province_region",
    "postal_code",
    "id_doc_country",
    "id_doc_type",
    "id_doc_front_file",
  ],
  acceptedFields: {
    ...lightKYC.acceptedFields,
    tax_id: "string",
    phone_number: "string",
    ip_address: "string",
    address_line_1: "string",
    address_line_2: "string",
    city: "string",
    state_province_region: "string",
    postal_code: "string",
    id_doc_country: "string",
    id_doc_type: "string",
    id_doc_front_file: "string",
    id_doc_back_file: "string",
    proof_of_address_doc_type: "string",
    proof_of_address_doc_file: "string",
  },
};

const standardKYB = {
  requiredFields: [
    ...lightKYB.requiredFields,
    "ip_address",
    "address_line_1",
    "city",
    "state_province_region",
    "postal_code",
    "incorporation_doc_file",
    "proof_of_ownership_doc_file",
    "owners",
  ],
  acceptedFields: {
    ...lightKYB.acceptedFields,
    website: "string",
    ip_address: "string",
    address_line_1: "string",
    address_line_2: "string",
    city: "string",
    state_province_region: "string",
    postal_code: "string",
    incorporation_doc_file: "string",
    proof_of_ownership_doc_file: "string",
    owners: "array",
  },
};

const ownerRequiredFields = [
  "first_name",
  "last_name",
  "role",
  "date_of_birth",
  "tax_id",
  "address_line_1",
  "city",
  "country",
  "state_province_region",
  "postal_code",
  "id_doc_country",
  "id_doc_type",
  "id_doc_front_file",
  "id_doc_back_file",
  "proof_of_address_doc_type",
  "proof_of_address_doc_file",
];

const ownerAcceptedFields = {
  first_name: "string",
  last_name: "string",
  role: "string",
  date_of_birth: "string",
  tax_id: "string",
  address_line_1: "string",
  address_line_2: "string",
  city: "string",
  country: "string",
  state_province_region: "string",
  postal_code: "string",
  id_doc_country: "string",
  id_doc_type: "string",
  id_doc_front_file: "string",
  id_doc_back_file: "string",
  proof_of_address_doc_type: "string",
  proof_of_address_doc_file: "string",
};

const receiverAcceptedFieldsMap = {
  individual: {
    light: lightKYC.acceptedFields,
    standard: standardKYC.acceptedFields,
  },
  business: {
    light: lightKYB.acceptedFields,
    standard: standardKYB.acceptedFields,
  },
};

const receiverRequiredFieldsMap = {
  individual: {
    light: lightKYC.requiredFields,
    standard: standardKYC.requiredFields,
  },
  business: {
    light: lightKYB.requiredFields,
    standard: standardKYB.requiredFields,
  },
};

const receiverFieldsNameMap = {
  user_id: "user_id",
  type: "type",
  role: "role",
  kyc_type: "kyc_type",
  kyc_status: "kyc_status",
  first_name: "first_name",
  last_name: "last_name",
  date_of_birth: "date_of_birth",
  email: "email",
  country: "country",
  legal_name: "legal_name",
  tax_id: "tax_id",
  formation_date: "formation_date",
  phone_number: "phone_number",
  ip_address: "ip_address",
  address_line_1: "address_line_1",
  address_line_2: "address_line_2",
  city: "city",
  state_province_region: "state_province_region",
  postal_code: "postal_code",
  id_doc_country: "id_doc_country",
  id_doc_type: "id_doc_type",
  id_doc_front_file: "id_doc_front_file",
  id_doc_back_file: "id_doc_back_file",
  proof_of_address_doc_type: "proof_of_address_doc_type",
  proof_of_address_doc_file: "proof_of_address_doc_file",
  website: "website",
  incorporation_doc_file: "incorporation_doc_file",
  proof_of_ownership_doc_file: "proof_of_ownership_doc_file",
  role: "role",
};

const pixAccountRequiredFields = [
  "user_id",
  "receiver_id",
  "type",
  "name",
  "pix_key",
];

const pixAccountAcceptedFields = {
  type: "string",
  user_id: "string",
  receiver_id: "string",
  name: "string",
  pix_key: "string",
};
const achAccountRequiredFields = [
  "user_id",
  "receiver_id",
  "type",
  "name",
  "beneficiary_name",
  "routing_number",
  "account_number",
  "account_type",
  "account_class",
];

const achAccountAcceptedFields = {
  type: "string",
  user_id: "string",
  receiver_id: "string",
  name: "string",
  beneficiary_name: "string",
  routing_number: "string",
  account_number: "string",
  account_type: "string",
  account_class: "string",
};

const wireAccountRequiredFields = [
  "user_id",
  "receiver_id",
  "type",
  "name",
  "beneficiary_name",
  "routing_number",
  "account_number",
  "address_line_1",
  "address_line_2",
  "city",
  "state_province_region",
  "country",
  "postal_code",
];

const wireAccountAcceptedFields = {
  type: "string",
  user_id: "string",
  receiver_id: "string",
  name: "string",
  beneficiary_name: "string",
  routing_number: "string",
  account_number: "string",
  address_line_1: "string",
  address_line_2: "string",
  city: "string",
  state_province_region: "string",
  country: "string",
  postal_code: "string",
};

const bankAccountAcceptedFieldsMap = {
  pix: pixAccountAcceptedFields,
  ach: achAccountAcceptedFields,
  wire: wireAccountAcceptedFields,
};

const bankAccountRequiredFieldsMap = {
  pix: pixAccountRequiredFields,
  ach: achAccountRequiredFields,
  wire: wireAccountRequiredFields,
};

const bankAccountFieldsNameMap = {
  user_id: "user_id",
  type: "type",
  name: "name",
  pix_key: "pix_key",
  beneficiary_name: "beneficiary_name",
  routing_number: "routing_number",
  account_number: "account_number",
  account_type: "account_type",
  account_class: "account_class",
  address_line_1: "address_line_1",
  address_line_2: "address_line_2",
  city: "city",
  state_province_region: "state_province_region",
  country: "country",
  postal_code: "postal_code",
};

module.exports = {
  receiverAcceptedFieldsMap,
  receiverRequiredFieldsMap,
  ownerRequiredFields,
  ownerAcceptedFields,
  receiverFieldsNameMap,
  bankAccountAcceptedFieldsMap,
  bankAccountRequiredFieldsMap,
  bankAccountFieldsNameMap,
};
