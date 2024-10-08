const { isValidDate, isValidEmail, isValidState, isValidCountryCode, isValidUrl, isValidIPv4, inStringEnum } = require("../common/filedValidationCheckFunctions");

const KycLevel = {
    ONE: 1,
    TWO: 2,
}

const individualKycOneRequiredFields = ["userType", "kycLevel", "legalFirstName", "legalLastName", "dateOfBirth", "signedAgreementId", "ipAddress"]

const individualKycOneAcceptedFields = {
    "userType": "string",
    "kycLevel": "number",
    "legalFirstName": "string",
    "legalLastName": "string",
    "dateOfBirth": (value) => isValidDate(value),
    "signedAgreementId": "string",
    "ipAddress": (value) => isValidIPv4(value)
}

const businessKycOneRequiredFields = ["userType", "kycLevel", "businessName", "signedAgreementId", "ipAddress", "ultimateBeneficialOwners"]

const businessKycOneAcceptedFields = {
    "userType": "string",
    "kycLevel": "number",
    "businessName": "string",
    "signedAgreementId": "string",
    "ipAddress": (value) => isValidIPv4(value),
	"ultimateBeneficialOwners": (value) => Array.isArray(value) && value.length > 0
}


const individualKycTwoRequiredFields = [
	"userType",
    "kycLevel",
	"legalFirstName",
	"legalLastName",
	"complianceEmail",
	"compliancePhone",
	"dateOfBirth",
	"taxIdentificationNumber",
	"govIdCountry",
	"govIdFront",
	"country",
	"addressLine1",
	"city",
	"postalCode",
	"stateProvinceRegion",
	"signedAgreementId",
	"ipAddress"
];

const individualKycTwoAcceptedFields = {
    "kycLevel": "number",
	"legalFirstName": "string",
	"legalLastName": "string",
	"dateOfBirth": (value) => isValidDate(value),
	"complianceEmail": (value) => isValidEmail(value),
	"compliancePhone": "string",
	"addressLine1": "string",
	"addressLine2": "string",
	"city": "string",
	"stateProvinceRegion": (value) => isValidState(value),
	"postalCode": "string",
	"country": (value) => isValidCountryCode(value),
	"addressType": "string",
	"taxIdentificationNumber": "string",
	"idType": "string",
	"proofOfResidency": (value) => isValidUrl(value),
	"govIdFront": (value) => isValidUrl(value),
	"govIdBack": (value) => isValidUrl(value),
	"govIdCountry": (value) => isValidCountryCode(value),
	"proofOfOwnership": (value) => isValidUrl(value),
	"formationDoc": (value) => isValidUrl(value),
	"businessName": "string",
	"businessDescription": "string",
	"businessType": (value) => inStringEnum(value, ["cooperative", "corporation", "llc", "partnership", "sole_prop", "trust", "other"]),
	"website": (value) => isValidUrl(value),
	"statementOfFunds": "string",
	"isDao": "boolean",
	"transmitsCustomerFunds": "boolean",
	"complianceScreeningExplanation": "string",
	"ipAddress": (value) => isValidIPv4(value),
	"signedAgreementId": "string",
	"userType": "string"
};

const UBOKycOneRequiredFields = [
	"legalFirstName",
	"legalLastName",
	"dateOfBirth",
	"isSigner",
	"hasControl"
];

const UBOKycOneAcceptedFields = {
	"legalFirstName": "string",
	"legalLastName": "string",
	"dateOfBirth": (value) => isValidDate(value),
	"isSigner": "boolean",
	"hasControl": "boolean",
};

const UBOKycTwoRequiredFields = [
	"legalFirstName",
	"legalLastName",
	"complianceEmail",
	"compliancePhone",
	"dateOfBirth",
	"taxIdentificationNumber",
	"govIdCountry",
	"govIdFront",
	"country",
	"addressLine1",
	"city",
	"postalCode",
	"stateProvinceRegion",
	"hasOwnership",
	"hasControl",
	"isSigner",
	"relationshipEstablishedAt"
];

const UBOKycTwoAcceptedFields = {
	"legalFirstName": "string",
	"legalLastName": "string",
	"dateOfBirth": (value) => isValidDate(value),
	"complianceEmail": (value) => isValidEmail(value),
	"compliancePhone": "string",
	"addressLine1": "string",
	"addressLine2": "string",
	"city": "string",
	"stateProvinceRegion": (value) => isValidState(value),
	"postalCode": "string",
	"country": (value) => isValidCountryCode(value),
	"taxIdentificationNumber": "string",
	"idType": "string",
	"proofOfResidency": (value) => isValidUrl(value),
	"govIdFront": (value) => isValidUrl(value),
	"govIdBack": (value) => isValidUrl(value),
	"govIdCountry": (value) => isValidCountryCode(value),
	"hasOwnership": "boolean",
	"hasControl": "boolean",
	"isSigner": "boolean",
	"relationshipEstablishedAt": (value) => isValidDate(value),
	"isWalletOwner": "boolean"
};

const businessKycTwoRequiredFields = [
    "kycLevel",
	"userType",
	"businessName",
	"businessType",
	"complianceEmail",
	"taxIdentificationNumber",
	"country",
	"addressLine1",
	"city",
	"postalCode",
	"stateProvinceRegion",
	"signedAgreementId",
	"ipAddress",
	"formationDoc",
	"sourceOfFunds",
	"ipAddress",
	"ultimateBeneficialOwners",
	"ipAddress",
	"transmitsCustomerFunds",
	"proofOfOwnership",
	"website",
	"businessDescription",
	"isDao"
];

const businessKycTwoAcceptedFields = {
    "kycLevel": "number",
	"legalFirstName": "string",
	"legalLastName": "string",
	"dateOfBirth": (value) => isValidDate(value),
	"complianceEmail": (value) => isValidEmail(value),
	"compliancePhone": "string",
	"addressLine1": "string",
	"addressLine2": "string",
	"city": "string",
	"stateProvinceRegion": (value) => isValidState(value),
	"postalCode": "string",
	"country": (value) => isValidCountryCode(value),
	"addressType": "string",
	"taxIdentificationNumber": "string",
	"idType": "string",
	"proofOfResidency": (value) => isValidUrl(value),
	"govIdFront": (value) => isValidUrl(value),
	"govIdBack": (value) => isValidUrl(value),
	"govIdCountry": (value) => isValidCountryCode(value),
	"proofOfOwnership": (value) => isValidUrl(value),
	"formationDoc": (value) => isValidUrl(value),
	"businessName": "string",
	"businessDescription": "string",
	"businessType": (value) => inStringEnum(value, ["cooperative", "corporation", "llc", "partnership", "sole_prop", "trust", "other"]),
	"website": (value) => isValidUrl(value),
	"sourceOfFunds": "string",
	"statementOfFunds": "string",
	"isDao": "boolean",
	"transmitsCustomerFunds": "boolean",
	"complianceScreeningExplanation": "string",
	"ipAddress": (value) => isValidIPv4(value),
	"signedAgreementId": "string",
	"userType": "string",
	"ultimateBeneficialOwners": (value) => Array.isArray(value) && value.length > 0

};


const userRequiredFieldsMap = {
    individual: {
        1: individualKycOneRequiredFields,
        2: individualKycTwoRequiredFields,
    },
    business: {
        1: businessKycOneRequiredFields,
        2: businessKycTwoRequiredFields,
    },
    ubo: {
        1: UBOKycOneRequiredFields,
        2: UBOKycTwoRequiredFields,
    }
};

const userAcceptedFieldsMap = {
    individual: {
      1: individualKycOneAcceptedFields,
      2: individualKycTwoAcceptedFields,
    },
    business: {
      1: businessKycOneAcceptedFields,
      2: businessKycTwoAcceptedFields,
    },
    ubo: {
      1: UBOKycOneAcceptedFields,
      2: UBOKycTwoAcceptedFields,
    }
};

const userKycColumnsMap = {
	userId: "user_id",
	legalFirstName: "legal_first_name",
	legalLastName: "legal_last_name",
	complianceEmail: "compliance_email",
	compliancePhone: "compliance_phone",
	addressLine1: "address_line_1",
	addressLine2: "address_line_2",
	city: "city",
	stateProvinceRegion: "state_province_region",
	postalCode: "postal_code",
	country: "country",
	addressType: "address_type",
	taxIdentificationNumber: "tax_identification_number",
	idType: "id_type",
	govIdCountry: "gov_id_country",
	businessName: "business_name",
	businessDescription: "business_description",
	businessType: "business_type",
	website: "website",
	statementOfFunds: "statement_of_funds",
	sourceOfFunds: "source_of_funds",
	isDao: "is_dao",
	transmitsCustomerFunds: "transmits_customer_funds",
	complianceScreeningExplanation: "compliance_screening_explanation",
	ipAddress: "ip_address",
	dateOfBirth: "date_of_birth",
	govIdFrontPath: "gov_id_front_path",
	govIdBackPath: "gov_id_back_path",
	proofOfResidencyPath: "proof_of_residency_path",
	proofOfOwnershipPath: "proof_of_ownership_path",
	formationDocPath: "formation_doc_path",
	signedAgreementId: "signed_agreement_id",
	hasOwnership: "has_ownership",
	hasControl: "has_control",
	isSigner: "is_signer",
	relationshipEstablishedAt: "relationship_established_at",
	isWalletOwner: "is_wallet_owner",
    kycLevel: "kyc_level",
}

module.exports = {
    userRequiredFieldsMap,
    userAcceptedFieldsMap,
    userKycColumnsMap,
    KycLevel
}