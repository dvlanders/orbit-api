const { inStringEnum } = require("../common/filedValidationCheckFunctions");

const BlindpayBankAccountType = {
  PIX : "pix",
  SPEI: "spei",
  TRANSFERS: "transfers",
  ACH_COP: "ach_cop"
}

const BlindpayBankAccountTypeRequestParamMapping = {
  [BlindpayBankAccountType.PIX]: "pix",
  [BlindpayBankAccountType.SPEI]: "spei_bitso",
  [BlindpayBankAccountType.TRANSFERS]: "transfers_bitso",
  [BlindpayBankAccountType.ACH_COP]: "ach_cop_bitso",
};

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
    id_doc_type: (value) => inStringEnum(value, ["PASSPORT", "ID_CARD", "DRIVERS"]),
    id_doc_front_file: "string",
    id_doc_back_file: "string",
    proof_of_address_doc_type: (value) => inStringEnum(value, ["UTILITY_BILL", "BANK_STATEMENT", "RENTAL_AGREEMENT", "TAX_DOCUMENT", "GOVERNMENT_CORRESPONDENCE"]),
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
  id_doc_type: (value) => inStringEnum(value, ["PASSPORT", "ID_CARD", "DRIVERS"]),
  id_doc_front_file: "string",
  id_doc_back_file: "string",
  proof_of_address_doc_type: (value) => inStringEnum(value, ["UTILITY_BILL", "BANK_STATEMENT", "RENTAL_AGREEMENT", "TAX_DOCUMENT", "GOVERNMENT_CORRESPONDENCE"]),
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
  kyc_failed_reasons: "kyc_failed_reasons",
};

const pixAccountRequiredFields = [
  "user_id",
  "receiver_id",
  "type",
  "name",
  "pix_key",
  "currency"
];

const pixAccountAcceptedFields = {
  type: "string",
  user_id: "string",
  receiver_id: "string",
  name: "string",
  pix_key: "string",
  currency: (value) => value === "brl",
};

const speiAccountRequiredFields = [
  "user_id",
  "receiver_id",
  "type",
  "name",
  "spei_protocol",
  "spei_clabe",
  "spei_institution_code",
  "beneficiary_name",
  "currency"
];

const speiAccountAcceptedFields = {
  type: "string",
  user_id: "string",
  receiver_id: "string",
  name: "string",
  spei_protocol: (value) => inStringEnum(value, ["clabe", "debitcard", "phonenum"]),
  spei_institution_code: "string",
  spei_clabe: "string",
  beneficiary_name: "string",
  currency: (value) => value === "mxn",
};

const transfersAccountRequiredFields = [
  "user_id",
  "receiver_id",
  "type",
  "name",
  "transfers_type",
  "transfers_account",
  "beneficiary_name",
  "currency"
];

const transfersAccountAcceptedFields = {
  type: "string",
  user_id: "string",
  receiver_id: "string",
  name: "string",
  transfers_type: (value) => inStringEnum(value, ["CVU", "CBU", "ALIAS"]),
  transfers_account: "string",
  beneficiary_name: "string",
  currency: (value) => value === "ars",
};

const achCopAccountRequiredFields = [
  "user_id",
  "receiver_id",
  "type",
  "name",
  "account_type",
  "ach_cop_beneficiary_first_name",
  "ach_cop_beneficiary_last_name",
  "ach_cop_document_id",
  "ach_cop_document_type",
  "ach_cop_email",
  "ach_cop_bank_code",
  "ach_cop_bank_account",
  "currency"
];

const achCopAccountAcceptedFields = {
  type: "string",
  user_id: "string",
  receiver_id: "string",
  name: "string",
  account_type: "string",
  ach_cop_beneficiary_first_name: "string",
  ach_cop_beneficiary_last_name: "string",
  ach_cop_document_id: "string",
  ach_cop_document_type: (value) => inStringEnum(value, ["CC", "CE", "NIT", "PASS", "PEP"]),
  ach_cop_email: "string",
  ach_cop_bank_code: "string",
  ach_cop_bank_account: "string",
  currency: (value) => value === "cop",
};

const bankAccountAcceptedFieldsMap = {
  pix: pixAccountAcceptedFields,
  spei: speiAccountAcceptedFields,
  transfers: transfersAccountAcceptedFields,
  ach_cop: achCopAccountAcceptedFields,
};

const bankAccountRequiredFieldsMap = {
  pix: pixAccountRequiredFields,
  spei: speiAccountRequiredFields,
  transfers: transfersAccountRequiredFields,
  ach_cop: achCopAccountRequiredFields,
};

const bankAccountFieldsNameMap = {
  user_id: "user_id",
  type: "type",
  name: "name",
  pix_key: "pix_key",
  beneficiary_name: "beneficiary_name",
  account_type: "account_type",
  address_line_1: "address_line_1",
  address_line_2: "address_line_2",
  city: "city",
  state_province_region: "state_province_region",
  country: "country",
  postal_code: "postal_code",
  spei_protocol: "spei_protocol",
  spei_institution_code: "spei_institution_code",
  spei_clabe: "spei_clabe",
  transfers_type: "transfers_type",
  transfers_account: "transfers_account",
  ach_cop_beneficiary_first_name: "ach_cop_beneficiary_first_name",
  ach_cop_beneficiary_last_name: "ach_cop_beneficiary_last_name",
  ach_cop_document_id: "ach_cop_document_id",
  ach_cop_document_type: "ach_cop_document_type",
  ach_cop_email: "ach_cop_email",
  ach_cop_bank_code: "ach_cop_bank_code",
  ach_cop_bank_account: "ach_cop_bank_account",
  currency: "currency",
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
  BlindpayBankAccountType,
  BlindpayBankAccountTypeRequestParamMapping
};
