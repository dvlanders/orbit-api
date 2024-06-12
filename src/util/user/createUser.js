const { sanctionedCountries, allowedUsState } = require("../bastion/utils/restrictedArea");
const { fieldsValidation } = require("../common/fieldsValidation");
const createLog = require("../logger/supabaseLogger");
const { uploadFileFromUrl } = require("../supabase/fileUpload");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");


const requiredFields = [
	"user_type",
	"legal_first_name",
	"legal_last_name",
	"compliance_email",
	"compliance_phone",
	"date_of_birth",
	"tax_identification_number",
	"gov_id_country",
	"country",
	"address_line_1",
	"city",
	"postal_code",
	"state_province_region",
	"signed_agreement_id",
	"ip_address"
];

const acceptedFields = {
	"id": "string",
    "created_at": "string",
    "user_id": "string",
    "legal_first_name": "string",
    "legal_last_name": "string",
    "date_of_birth": "string",
    "compliance_email": "string",
    "compliance_phone": "string",
    "address_line_1": "string",
    "address_line_2": "string",
    "city": "string",
    "state_province_region": "string",
    "postal_code": "string",
    "country": "string",
    "address_type": "string",
    "tax_identification_number": "string",
    "id_type": "string",
    "proof_of_residency": "string",
    "gov_id_front": "string",
    "gov_id_back": "string",
    "gov_id_country": "string",
    "proof_of_ownership": "string",
    "formation_doc": "string",
    "business_name": "string",
    "business_description": "string",
    "business_type": "string",
    "website": "string",
    "source_of_funds": "string",
    "is_dao": "string",
    "transmits_customer_funds": "string",
    "compliance_screening_explanation": "string",
    "ip_address": "string",
    "signed_agreement_id": "string",
    "user_type": "string"
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
	const isIpAllowed = await ipCheck(fields.ip_address)
	if (!isIpAllowed) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", {error: "Unsupported area (ip_address)"})
	
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
				{ profile_id: profileId, user_type: fields.user_type },
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
				{ user_id: userId, signed_agreement_id: fields.signed_agreement_id },
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
			key: "gov_id_front",
			bucket: "compliance_id",
			columnName: "gov_id_front_path"
		},
		{
			key: "gov_id_back",
			bucket: "compliance_id",
			columnName: "gov_id_back_path"
		},
		{
			key: "proof_of_residency",
			bucket: "proof_of_residency",
			columnName: "proof_of_residency_path"
		},
		{
			key: "proof_of_ownership",
			bucket: "proof_of_ownership",
			columnName: "proof_of_ownership_path"
		},
		{
			key: "formation_doc",
			bucket: "formation_doc",
			columnName: "formation_doc_path"
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
				legal_first_name: fields.legal_first_name,
				legal_last_name: fields.legal_last_name,
				compliance_email: fields.compliance_email,
				compliance_phone: fields.compliance_phone,
				address_line_1: fields.address_line_1,
				address_line_2: fields.address_line_2,
				city: fields.city,
				state_province_region: fields.state_province_region,
				postal_code: fields.postal_code,
				country: fields.country,
				address_type: fields.address_type,
				tax_identification_number: fields.tax_identification_number,
				id_type: fields.id_type,
				gov_id_country: fields.gov_id_country,
				business_name: fields.business_name,
				business_description: fields.business_description,
				business_type: fields.business_type,
				website: fields.website,
				source_of_funds: fields.source_of_funds,
				is_dao: fields.is_dao,
				transmits_customer_funds: fields.transmits_customer_funds,
				compliance_screening_explanation: fields.compliance_screening_explanation,
				ip_address: fields.ip_address,
				date_of_birth: new Date(fields.date_of_birth).toISOString(),
				gov_id_front_path: fields.gov_id_front_path,
				gov_id_back_path: fields.gov_id_back_path,
				proof_of_residency_path: fields.proof_of_residency_path,
				proof_of_ownership_path: fields.proof_of_ownership_path,
				formation_doc_path: fields.formation_doc_path
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
	if (fields.ip_address){
		const isIpAllowed = await ipCheck(fields.ip_address)
		if (!isIpAllowed) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", {error: "Unsupported area (ip_address)"})
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
			key: "gov_id_front",
			bucket: "compliance_id",
			columnName: "gov_id_front_path"
		},
		{
			key: "gov_id_back",
			bucket: "compliance_id",
			columnName: "gov_id_back_path"
		},
		{
			key: "proof_of_residency",
			bucket: "proof_of_residency",
			columnName: "proof_of_residency_path"
		},
		{
			key: "proof_of_ownership",
			bucket: "proof_of_ownership",
			columnName: "proof_of_ownership_path"
		},
		{
			key: "formation_doc",
			bucket: "formation_doc",
			columnName: "formation_doc_path"
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
		.update(fields)
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
}