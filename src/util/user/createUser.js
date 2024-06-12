
const isRequiredFieldsForIndividualCustomerProvided = (fields) => {

	const required = [
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
	const missingFields = []

	required.map((key) => {
		if (!fields[key] || fields[key] == "") {
			missingFields.push(key)
		}
	})

	return missingFields


}

// Function to validate KYC data
const isFieldsForIndividualCustomerValid = (fields) => {
	// Check if all columns are present in the data object
	const userKYCColumns = new Set([
		"id",
		"created_at",
		"user_id",
		"legal_first_name",
		"legal_last_name",
		"date_of_birth",
		"compliance_email",
		"compliance_phone",
		"address_line_1",
		"address_line_2",
		"city",
		"state_province_region",
		"postal_code",
		"country",
		"address_type",
		"tax_identification_number",
		"id_type",
		"proof_of_residency",
		"gov_id_front",
		"gov_id_back",
		"gov_id_country",
		"proof_of_ownership",
		"formation_doc",
		"business_name",
		"business_description",
		"business_type",
		"website",
		"source_of_funds",
		"is_dao",
		"transmits_customer_funds",
		"compliance_screening_explanation",
		"ip_address",
		"signed_agreement_id",
		"user_type"
	]);

	for (const key of Object.keys(fields)) {
		if (!userKYCColumns.has(key)) {
			return key
		}
	}


	return null;
}

// Function to upload information
const InformationUploadErrorType = {
	INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	INVALID_FEILD: "INVALID_FEILD",
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

const informationUploadForCreateUser = async(userId, fields) => {
	// check if required fields are uploaded
	const missingFields = isRequiredFieldsForIndividualCustomerProvided(fields)

	if (missingFields && missingFields.length > 0) {
		throw new InformationUploadError(InformationUploadErrorType.FIELD_MISSING, 400, "", { error: 'please provide required fields', missing_fields: missingFields })
	}
	

	// check if the field that is passsed is a valid field that we allow updates on
	const invalidField = isFieldsForIndividualCustomerValid(fields)
	if (invalidField) {
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FEILD, 400, "", {error: `${invalidField} is not accepted`})
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
		createLog("user/create", userId, error.message, error)
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
		createLog("user/create", userId, error.message, error)
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}

}

const informationUploadForUpdateUser = async(userId, fields) => {
	
	// check if the field that is passsed is a valid field that we allow updates on
	const invalidField = isFieldsForIndividualCustomerValid(fields)
	if (invalidField) {
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FEILD, 400, "", {error: `${invalidField} is not accepted`})
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
		createLog("user/update", userId, error.message, error)
		if (error.type && (error.type == fileUploadErrorType.FILE_TOO_LARGE || error.type == fileUploadErrorType.INVALID_FILE_TYPE)) {
			throw new InformationUploadError(error.type, 400, "", { error: error.message })
		}
		// internal server error
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}


	// update the user_kyc table record	
	const { data, error } = await supabaseCall(() => supabase
		.from('user_kyc')
		.insert(fields)
		.select()
	)

	if (error) {
		createLog("user/update", userId, error.message, error)
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" })
	}

}


module.exports = {
	isFieldsForIndividualCustomerValid,
	isRequiredFieldsForIndividualCustomerProvided,
	informationUploadForCreateUser,
	informationUploadForUpdateUser
}