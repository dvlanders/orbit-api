const { isArray } = require("lodash");
const { sanctionedCountries, allowedUsState } = require("../bastion/utils/restrictedArea");
const { fieldsValidation } = require("../common/fieldsValidation");
const { isValidDate, isValidEmail, isValidState, isValidCountryCode, isValidUrl, isValidIPv4, inStringEnum } = require("../common/filedValidationCheckFunctions");
const createLog = require("../logger/supabaseLogger");
const { uploadFileFromUrl, fileUploadErrorType } = require("../supabase/fileUpload");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { checkIsSignedAgreementIdSigned } = require("./signedAgreement");

const individualRequiredFields = [
	"userType",
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

const individualAcceptedFields = {
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

const UBORequiredFields = [
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
];

const UBOAcceptedFields = {
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
};



const businessRequiredFields = [
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

const businessAcceptedFields = {
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
	signedAgreementId: "signed_agreement_id"
}


const fieldsToColumnsMap = (fields, map) => {
	const mapped = {}

	Object.keys(fields).map((key) => {
		if (!(key in map)) return
		mapped[map[key]] = fields[key]
	})

	return mapped
}



// Function to upload information
const InformationUploadErrorType = {
	INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	INVALID_FIELD: "INVALID_FIELD",
	FIELD_MISSING: "FIELD_MISSING",
	FILE_TOO_LARGE: "FILE_TOO_LARGE"
};

class InformationUploadError extends Error {
	constructor(type, status, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		this.status = status
		Object.setPrototypeOf(this, InformationUploadError.prototype);
	}
}

const informationUploadForCreateUser = async (profileId, fields) => {
	// check ip address
	let requiredFields, acceptedFields;
	if (fields.userType === "business") {
		requiredFields = businessRequiredFields;
		acceptedFields = businessAcceptedFields;
	} else {
		requiredFields = individualRequiredFields;
		acceptedFields = individualAcceptedFields;
	}

	// check ip address
	const {isIpAllowed, message} = await ipCheck(fields.ipAddress);
	if (!isIpAllowed) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `Invalid ipAddress, ${message}` });

	// check signedAgreementId only for prod
	if (process.env.NODE_ENV == "production") {
		if (!(await checkIsSignedAgreementIdSigned(fields.signedAgreementId))) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: "Invalid signedAgreementId" });
	}

	// check if required fields are uploaded and validate field values
	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields);
	if (missingFields.length > 0 || invalidFields.length > 0) {
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields });
	}

	// check if the ultimate beneficial owners are valid
	if (fields.userType == "business") {
		fields.ultimateBeneficialOwners.map((owner, index) => {
			// check UBO field values
			const { missingFields, invalidFields } = fieldsValidation(owner, UBORequiredFields, UBOAcceptedFields);
			if (missingFields.length > 0 || invalidFields.length > 0) {
				throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `Fields of ultimateBeneficialOwner[${index}] provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields });
			}
		})
	}


	// Create new user
	let userId;
	try {
		const { data: newUser, error: newUserError } = await supabaseCall(() => supabase
			.from('users')
			.insert({ profile_id: profileId, user_type: fields.userType })
			.select()
			.single()
		);
		if (newUserError) throw newUserError;
		userId = newUser.id;
	} catch (error) {
		await createLog("user/util/informationUploadForCreateUser", null, error.message, error, profileId);
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
	}

	// create bridge record and input signed agreement id
	try {
		const { error: newBridgeRecordError } = await supabaseCall(() => supabase
			.from('bridge_customers')
			.insert(
				{ user_id: userId },
			)
			.select())

		if (newBridgeRecordError) throw newBridgeRecordError

	} catch (error) {
		await createLog("user/util/informationUploadForCreateUser", userId, error.message, error, profileId)
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}

	// STEP 1: Save the updated fields to the user_kyc table
	// upload file
	const files = [
		{
			key: "govIdFront",
			bucket: "compliance_id",
			columnName: "govIdFrontPath"
		},
		{
			key: "govIdBack",
			bucket: "compliance_id",
			columnName: "govIdBackPath"
		},
		{
			key: "proofOfResidency",
			bucket: "proof_of_residency",
			columnName: "proofOfResidencyPath"
		},
		{
			key: "proofOfOwnership",
			bucket: "proof_of_ownership",
			columnName: "proofOfOwnershipPath"
		},
		{
			key: "formationDoc",
			bucket: "formation_doc",
			columnName: "formationDocPath"
		},

	]

	try {
		// Iterate over the files and upload only those that are present in the fields object
		await Promise.all(files.map(async (file) => {
			if (fields[file.key]) {
				fields[file.columnName] = await uploadFileFromUrl(fields[file.key], file.bucket, `${userId}/${file.key}`);
				delete fields[file.key]
			}
		}))

	} catch (error) {
		await createLog("user/util/informationUploadForCreateUser", userId, error.message, error)
		if (error.type && (error.type == fileUploadErrorType.FILE_TOO_LARGE || error.type == fileUploadErrorType.FILE_TOO_SMALL || error.type == fileUploadErrorType.INVALID_FILE_TYPE || fileUploadErrorType.FAILED_TO_FETCH)) {
			throw new InformationUploadError(error.type, 400, "", { error: error.message })
		}
		// internal server error
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: "Unexpected error happened" })
	}

	// Map fields to database columns
	const kycData = {};
	Object.keys(fields).forEach(field => {
		const column = userKycColumnsMap[field];
		if (column && fields[field] !== undefined) {
			kycData[column] = fields[field];
		}
	});

	// Handle specific data type transformations if necessary, e.g., date of birth
	if (fields.dateOfBirth) {
		kycData.date_of_birth = new Date(fields.dateOfBirth).toISOString();
	}

	kycData.user_id = userId;


	// update the user_kyc table record  
	const { data, error } = await supabaseCall(() => supabase
		.from('user_kyc')
		.insert(kycData) // Ensure kycData is used correctly here
		.select()
	);

	if (error) {
		console.error(error);
		await createLog("user/util/informationUploadForCreateUser", userId, error.message, error);
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
	}


	// insert records into the ultimate_beneficial_owners table from the ultimateBeneficialOwners array

	// only save ultimate beneficial owners if the ultimateBeneficialOwners array is not empt/null
	if (fields.ultimateBeneficialOwners && fields.ultimateBeneficialOwners.length > 0) {
		const { ultimateBeneficialOwners } = fields;

		// Define the files to be uploaded for each UBO
		const uboFiles = [
			{
				key: "govIdFront",
				bucket: "compliance_id",
				columnName: "gov_id_front_path"
			},
			{
				key: "govIdBack",
				bucket: "compliance_id",
				columnName: "gov_id_back_path"
			},

			{
				key: "proofOfResidency",
				bucket: "proof_of_residency",
				columnName: "proof_of_residency_path"
			}

		];

		// Process each UBO

		try {
			const processedUbos = await Promise.all(ultimateBeneficialOwners.map(async (owner, index) => {
				// Upload files for each UBO
				await Promise.all(uboFiles.map(async (file) => {
					if (owner[file.key]) {
						owner[file.columnName] = await uploadFileFromUrl(
							owner[file.key],
							file.bucket,
							`${userId}/ubo_${index + 1}_${file.key}`
						);
						delete owner[file.key];
					}
				}));

				// Return the processed UBO data with is_primary set to true only for the first owner
				return {
					user_id: userId,
					legal_first_name: owner.legalFirstName,
					legal_last_name: owner.legalLastName,
					compliance_phone: owner.compliancePhone,
					compliance_email: owner.complianceEmail,
					address_line_1: owner.addressLine1,
					address_line_2: owner.addressLine2,
					city: owner.city,
					state_province_region: owner.stateProvinceRegion,
					postal_code: owner.postalCode,
					country: owner.country,
					address_type: owner.addressType,
					date_of_birth: new Date(owner.dateOfBirth).toISOString(),
					tax_identification_number: owner.taxIdentificationNumber,
					id_type: owner.idType,
					gov_id_country: owner.govIdCountry,
					gov_id_front_path: owner.gov_id_front_path,
					gov_id_back_path: owner.gov_id_back_path,
					proof_of_residency_path: owner.proof_of_residency_path,
					is_primary: index === 0 // sets the first ubo's is_primary to true and sets the rest to false
				};
			}));



			// Insert the processed UBO data into the database
			const { data: ultimateBeneficialOwnersData, error: ultimateBeneficialOwnersError } = await supabaseCall(() =>
				supabase
					.from('ultimate_beneficial_owners')
					.insert(processedUbos)
					.select()
			);

			if (ultimateBeneficialOwnersError) {
				// Handle the error
				console.error(ultimateBeneficialOwnersError);
				throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "Error inserting UBO data", { error: ultimateBeneficialOwnersError.message });
			}
		} catch (error) {
			console.error(error)
			await createLog("user/util/informationUploadForCreateUser", userId, error.message, error)
			if (error.type && (error.type == fileUploadErrorType.FILE_TOO_LARGE || error.type == fileUploadErrorType.FILE_TOO_SMALL || error.type == fileUploadErrorType.INVALID_FILE_TYPE)) {
				throw new InformationUploadError(error.type, 400, "", { error: error.message })
			}

			if (error.type && error.type == InformationUploadErrorType.INVALID_FIELD) {
				throw error
			}
			// internal server error
			throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })

		}



	}

	return userId

}

const informationUploadForUpdateUser = async (userId, fields) => {

	// check ip address
	if (fields.ipAddress) {
		const {isIpAllowed, message} = await ipCheck(fields.ipAddress)
		if (!isIpAllowed) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `Invalid ipAddress, ${message}` })
	}

	let acceptedFields;
	if (fields.userType === "business") {
		acceptedFields = businessAcceptedFields;
	} else {
		acceptedFields = individualAcceptedFields;
	}

	// check if required fields are uploaded
	// check if the field that is passsed is a valid field that we allow updates on
	const { missingFields, invalidFields } = fieldsValidation(fields, [], acceptedFields)
	if (missingFields.length > 0 || invalidFields.length > 0) {
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
	}

	// STEP 1: Save the updated fields to the user_kyc table
	// upload file
	const files = [
		{
			key: "govIdFront",
			bucket: "compliance_id",
			columnName: "govIdFrontPath"
		},
		{
			key: "govIdBack",
			bucket: "compliance_id",
			columnName: "govIdBackPath"
		},
		{
			key: "proofOfResidency",
			bucket: "proof_of_residency",
			columnName: "proofOfResidencyPath"
		},
		{
			key: "proofOfOwnership",
			bucket: "proof_of_ownership",
			columnName: "proofOfOwnershipPath"
		},
		{
			key: "formationDoc",
			bucket: "formation_doc",
			columnName: "formationDocPath"
		},

	]

	try {
		// Iterate over the files and upload only those that are present in the fields object
		await Promise.all(files.map(async (file) => {
			if (fields[file.key]) {
				fields[file.columnName] = await uploadFileFromUrl(fields[file.key], file.bucket, `${userId}/${file.key}`);
				delete fields[file.key]
			}
		}))

	} catch (error) {
		await createLog("user/util/informationUploadForUpdateUser", userId, error.message, error)
		if (error.type && (error.type == fileUploadErrorType.FILE_TOO_LARGE || error.type == fileUploadErrorType.FILE_TOO_SMALL || error.type == fileUploadErrorType.INVALID_FILE_TYPE)) {
			throw new InformationUploadError(error.type, 400, "", { error: error.message })
		}
		// internal server error
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}


	// update the user_kyc table record	
	const { data, error } = await supabaseCall(() => supabase
		.from('user_kyc')
		.update(fieldsToColumnsMap(fields, userKycColumnsMap))
		.eq("user_id", userId)
		.select()
	)
	if (error) {
		console.error(error)
		await createLog("user/util/informationUploadForUpdateUser", userId, error.message, error)
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}

}

const ipCheck = async (ip) => {
    // check if ip is valid IPv4.
    if (!isValidIPv4(ip))
        return {ipAllowed: false, message: "please make sure IP address provided is a public IPv4."}

	// request options
	const options = {
		method: 'GET',
		headers: {
			'Authorization': 'Basic ' + Buffer.from(`${process.env.MAXMIND_ACCOUNT_ID}:${process.env.MAXMIND_LICENSE_KEY}`).toString('base64')
		}
	};

	const locationRes = await fetch(`https://geolite.info/geoip/v2.1/city/${ip}`, options);
	const locationData = await locationRes.json();
	if (locationRes.ok) {
		if (!locationData.traits) {
			return {ipAllowed: false, message: "unable to determine the geographic location from the provided IP address. "}
		}
		if (sanctionedCountries.includes(locationData.country.iso_code)) {
			return {ipAllowed: false, message: "country information could not be retrieved for the provided IP address."}
		}
		if (locationData.country.iso_code == "US"){
            if (!locationData.subdivisions || !isArray(locationData.subdivisions))
                return {ipAllowed: false, message: "state/province information could not be retrieved for the provided IP address."}
            else if (!allowedUsState.includes(locationData.subdivisions[0]['iso_code']))
                return {ipAllowed: false, message: "please make sure provided IP address is not from unsupported area. (https://docs.hifibridge.com/reference/supported-regionscountries)"}
        }
	} else {
		console.error(locationData)
		await createLog("user/util/ipCheck", null, "failed to get ip information", locationData)
		throw new Error("failed to get ip information")
	}

	return {isIpAllowed: true, message: ""}
};


module.exports = {
	InformationUploadError,
	ipCheck,
	informationUploadForCreateUser,
	informationUploadForUpdateUser,
	fieldsToColumnsMap
}