const { sanctionedCountries, allowedUsState } = require("../bastion/utils/restrictedArea");
const { fieldsValidation } = require("../common/fieldsValidation");
const createLog = require("../logger/supabaseLogger");
const { uploadFileFromUrl } = require("../supabase/fileUpload");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const requiredFields = [
	"userType",
	"legalFirstName",
	"legalLastName",
	"complianceEmail",
	"compliancePhone",
	"dateOfBirth",
	"taxIdentificationNumber",
	"govIdCountry",
	"country",
	"addressLine1",
	"city",
	"postalCode",
	"stateProvinceRegion",
	"signedAgreementId",
	"ipAddress"
];

const acceptedFields = {
	"id": "string",
    "createdAt": "string",
    "legalFirstName": "string",
    "legalLastName": "string",
    "dateOfBirth": "string",
    "complianceEmail": "string",
    "compliancePhone": "string",
    "addressLine1": "string",
    "addressLine2": "string",
    "city": "string",
    "stateProvinceRegion": "string",
    "postalCode": "string",
    "country": "string",
    "addressType": "string",
    "taxIdentificationNumber": "string",
    "idType": "string",
    "proofOfResidency": "string",
    "govIdFront": "string",
    "govIdBack": "string",
    "govIdCountry": "string",
    "proofOfOwnership": "string",
    "formationDoc": "string",
    "businessName": "string",
    "businessDescription": "string",
    "businessType": "string",
    "website": "string",
    "sourceOfFunds": "string",
    "isDao": "string",
    "transmitsCustomerFunds": "string",
    "complianceScreeningExplanation": "string",
    "ipAddress": "string",
    "signedAgreementId": "string",
    "userType": "string"
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
	formationDocPath: "formation_doc_path"
}


const fieldsToColumnsMap = (fields, map) => {
	const mapped = {}

	Object.keys(fields).map((key) => {
		mapped[map[key]] = fields[key]
	})

	return mapped
}

	

// Function to upload information
const InformationUploadErrorType = {
	INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	INVALID_FIELD: "INVALID_FIELD",
	FIELD_MISSING:  "FIELD_MISSING",
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

const informationUploadForCreateUser = async(profileId, fields) => {
	// check ip address
	const isIpAllowed = await ipCheck(fields.ipAddress)
	if (!isIpAllowed) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", {error: "Unsupported area (ipAddress)"})
	
	// check if required fields are uploaded
	// check if the field that is passsed is a valid field that we allow updates on
	const {missingFields, invalidFields} = fieldsValidation(fields, requiredFields, acceptedFields)
	if (missingFields.length > 0 || invalidFields.length > 0){
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", {error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields})
	}
	
	
	// create new user
	let userId
	try {
		const { data: newUser, error: newUserError } = await supabaseCall(() => supabase
			.from('users')
			.insert(
				{ profile_id: profileId, user_type: fields.userType },
			)
			.select()
			.single()
		)

		if (newUserError) throw newUserError
		userId = newUser.id
	} catch (error) {
		createLog("user/util/informationUploadForCreateUser", "", error.message, error)
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}

	// create bridge record and input signed agreement id
	try {
		const { error: newBridgeRecordError } = await supabaseCall(() => supabase
			.from('bridge_customers')
			.insert(
				{ user_id: userId, signed_agreement_id: fields.signedAgreementId },
			)
			.select())

		if (newBridgeRecordError) throw newBridgeRecordError

	} catch (error) {
		createLog("user/util/informationUploadForCreateUser", "", error.message, error)
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
		createLog("user/util/informationUploadForCreateUser", userId, error.message, error)
		if (error.type && (error.type == fileUploadErrorType.FILE_TOO_LARGE || error.type == fileUploadErrorType.INVALID_FILE_TYPE)) {
			throw new InformationUploadError(error.type, 400, "", { error: error.message })
		}
		// internal server error
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}


	// update the user_kyc table record	
	const { data, error } = await supabaseCall(() => supabase
		.from('user_kyc')
		.insert(
			{
				user_id: userId,
				legal_first_name: fields.legalFirstName,
				legal_last_name: fields.legalLastName,
				compliance_email: fields.complianceEmail,
				compliance_phone: fields.compliancePhone,
				address_line_1: fields.addressLine1,
				address_line_2: fields.addressLine2,
				city: fields.city,
				state_province_region: fields.stateProvinceRegion,
				postal_code: fields.postalCode,
				country: fields.country,
				address_type: fields.addressType,
				tax_identification_number: fields.taxIdentificationNumber,
				id_type: fields.idType,
				gov_id_country: fields.govIdCountry,
				business_name: fields.businessName,
				business_description: fields.businessDescription,
				business_type: fields.businessType,
				website: fields.website,
				source_of_funds: fields.sourceOfFunds,
				is_dao: fields.isDao,
				transmits_customer_funds: fields.transmitsCustomerFunds,
				compliance_screening_explanation: fields.complianceScreeningExplanation,
				ip_address: fields.ipAddress,
				date_of_birth: new Date(fields.dateOfBirth).toISOString(),
				gov_id_front_path: fields.govIdFrontPath,
				gov_id_back_path: fields.govIdBackPath,
				proof_of_residency_path: fields.proofOfResidencyPath,
				proof_of_ownership_path: fields.proofOfOwnershipPath,
				formation_doc_path: fields.formationDocPath
			}			
		)
		.select()
	)

	if (error) {
		createLog("user/util/informationUploadForCreateUser", userId, error.message, error)
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}

	return userId

}

const informationUploadForUpdateUser = async(userId, fields) => {

	// check ip address
	if (fields.ipAddress){
		const isIpAllowed = await ipCheck(fields.ipAddress)
		if (!isIpAllowed) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", {error: "Unsupported area (ipAddress)"})
	}
	
	// check if required fields are uploaded
	// check if the field that is passsed is a valid field that we allow updates on
	const {missingFields, invalidFields} = fieldsValidation(fields, [], acceptedFields)
	if (missingFields.length > 0 || invalidFields.length > 0){
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", {error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields})
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
		createLog("user/util/informationUploadForUpdateUser", userId, error.message, error)
		if (error.type && (error.type == fileUploadErrorType.FILE_TOO_LARGE || error.type == fileUploadErrorType.INVALID_FILE_TYPE)) {
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
	)

	if (error) {
		console.error(error)
		createLog("user/util/informationUploadForUpdateUser", userId, error.message, error)
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}

}

const ipCheck = async (ip) => {
  
	const locationRes = await fetch(`https://ipapi.co/${ip}/json/`);
	if (locationRes.ok) {
		const locaionData = await locationRes.json();
		if (sanctionedCountries.includes(locaionData.country_code_iso3)) {
			return false
		}
		if (locaionData.country_code_iso3 == "USA" && !allowedUsState.includes(locaionData.region_code)){
			console.log("not supported")
			return false
		}
	} else {
		createLog("user/util/ipCheck", "", "failed to get ip information")
		throw new Error("failed to get ip information") 
	}
  
	return true
  };


module.exports = {
	InformationUploadError,
	ipCheck,
	informationUploadForCreateUser,
	informationUploadForUpdateUser,
	fieldsToColumnsMap
}