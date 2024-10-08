const { isArray } = require("lodash");
const { sanctionedCountries, allowedUsState } = require("../bastion/utils/restrictedArea");
const { fieldsValidation } = require("../common/fieldsValidation");
const { isValidDate, isValidEmail, isValidState, isValidCountryCode, isValidUrl, isValidIPv4, inStringEnum } = require("../common/filedValidationCheckFunctions");
const createLog = require("../logger/supabaseLogger");
const { uploadFileFromUrl, fileUploadErrorType } = require("../supabase/fileUpload");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { checkIsSignedAgreementIdSigned } = require("./signedAgreement");
const { InformationUploadErrorType, InformationUploadError } = require("./errors");
const { userRequiredFieldsMap, userAcceptedFieldsMap, userKycColumnsMap } = require("./utils");
const { insertUserRecord, insertUserKycRecord, getUserRecord, updateUserRecord, updateUserKycRecord } = require("./userService");
const { insertBridgeCustomerRecord } = require("../bridge/bridgeService");


const fieldsToColumnsMap = (fields, map) => {
	const mapped = {}

	Object.keys(fields).map((key) => {
		if (!(key in map)) return
		mapped[map[key]] = fields[key]
	})

	return mapped
}

const saveUserFiles = async (userId, fields) => {

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
		throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened" })
	}


}

const saveUboData = async (userId, ultimateBeneficialOwners) => {

	if (ultimateBeneficialOwners && ultimateBeneficialOwners.length > 0) {

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
			let walletOwnerIndex = null
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
				// get wallet owner index
				if (walletOwnerIndex == null && owner.isWalletOwner) walletOwnerIndex = index
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
					date_of_birth: owner.dateOfBirth ? new Date(owner.dateOfBirth).toISOString() : null,
					tax_identification_number: owner.taxIdentificationNumber,
					id_type: owner.idType,
					gov_id_country: owner.govIdCountry,
					gov_id_front_path: owner.gov_id_front_path,
					gov_id_back_path: owner.gov_id_back_path,
					proof_of_residency_path: owner.proof_of_residency_path,
					has_control: owner.hasControl,
					has_ownership: owner.hasOwnership,
					is_signer: owner.isSigner,
					relationship_established_at: owner.relationshipEstablishedAt ? new Date(owner.relationshipEstablishedAt).toISOString() : null,
					is_primary: false
				};
			}));

			// if wallet owner is not set, set the first ubo with has_control equals true as the wallet owner
			if (walletOwnerIndex == null) {
				walletOwnerIndex = processedUbos.findIndex((ubo) => ubo.has_control)
			}

			// set the wallet owner's is_primary to true
			processedUbos[walletOwnerIndex].is_primary = true

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
}

const updateUboData = async (userId, ultimateBeneficialOwners) => {
	if(ultimateBeneficialOwners && ultimateBeneficialOwners.length > 0) {
		// Delete old uboData and save new uboData
		const { error: uboDeleteError } = await supabaseCall(() => supabase
				.from('ultimate_beneficial_owners')
				.delete()
				.eq("user_id", userId));

		if (uboDeleteError) {
			throw new InformationUploadError(InformationUploadErrorType.INTERNAL_ERROR, 500, "Error deleting UBO data", { error: uboDeleteError.message });
		}
		await saveUboData(userId, ultimateBeneficialOwners);
	}
}

const informationUploadForCreateUser = async (profileId, fields) => {
	if (!fields.userType || !fields.kycLevel) {
		throw new InformationUploadError(
			InformationUploadErrorType.FIELD_MISSING,
		  400,
		  "",
		  {
			error: `userType or kycLevel is missing`,
		  }
		);
	}

	const requiredFields = userRequiredFieldsMap[fields.userType]?.[fields.kycLevel];
  	const acceptedFields = userAcceptedFieldsMap[fields.userType]?.[fields.kycLevel];

	if (!requiredFields || !acceptedFields) {
		throw new InformationUploadError(
			InformationUploadErrorType.INVALID_FIELD,
			400,
			"",
			{
			error: `userType or kycLevel is invalid`,
			}
		);
	}

	// check if required fields are uploaded and validate field values
	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields);
	if (missingFields.length > 0 || invalidFields.length > 0) {
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields });
	}

    if (fields.stateProvinceRegion && !isValidState(fields.stateProvinceRegion))
        throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `${fields.stateProvinceRegion} is not a supported state for user creation. See here for a list of supported regions: https://docs.hifibridge.com/docs/supported-networks-chains-tokens` });

	// check ip address
	const {ipValid, message} = await ipCheck(fields.ipAddress);
	if (!ipValid) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `Invalid ipAddress, ${message}`, missingFields: [], invalidFields: ["ipAddress"] });

	// check signedAgreementId only for prod
	if (process.env.NODE_ENV == "production") {
		if (!(await checkIsSignedAgreementIdSigned(fields.signedAgreementId))) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: "Invalid signedAgreementId" });
	}

	// field validation check for ultimate beneficial owners
	if (fields.userType == "business") {

		const UBORequiredFields = userRequiredFieldsMap.ubo[fields.kycLevel];
		const UBOAcceptedFields = userAcceptedFieldsMap.ubo[fields.kycLevel];

		// at least one UBO have isSigner and one UBO have hasControl
		let isSignerExists = false
		let hasControlExists = false
		fields.ultimateBeneficialOwners.map((owner, index) => {
			// check UBO field values
			const { missingFields, invalidFields } = fieldsValidation(owner, UBORequiredFields, UBOAcceptedFields);
			if (missingFields.length > 0 || invalidFields.length > 0) {
				throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `Fields of ultimateBeneficialOwner[${index}] provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields });
			}
			// check if isSigner and hasControl exists
			if (owner.isSigner) isSignerExists = true
			if (owner.hasControl) hasControlExists = true
		})
		if (!isSignerExists) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: "At least one ultimateBeneficialOwners must have isSigner set to true", missingFields: [], invalidFields: ["isSigner"] });
		if (!hasControlExists) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: "At least one ultimateBeneficialOwners must have hasControl set to true", missingFields: [], invalidFields: ["hasControl"] });
	}

	const newUser = await insertUserRecord({ profile_id: profileId, user_type: fields.userType, kyc_level: fields.kycLevel });
	const userId = newUser.id;

	// create bridge customer record
	const bridgeCustomerData = await insertBridgeCustomerRecord({ user_id: userId });

	// Save the files to the user_kyc table
	await saveUserFiles(userId, fields);

	// Map fields to database columns
	const kycData = {};
	Object.keys(fields).forEach(field => {
		const column = userKycColumnsMap[field];
		if (column && fields[field] !== undefined) {
			kycData[column] = fields[field];
		}
	});

	// Handle specific data type transformations if necessary, e.g., date of birth
	if (fields.dateOfBirth) kycData.date_of_birth = new Date(fields.dateOfBirth).toISOString();

	kycData.user_id = userId;

	const userKycData = await insertUserKycRecord(kycData);

	await saveUboData(userId, fields.ultimateBeneficialOwners);

	return userId

}

const informationUploadForUpdateUser = async (userId, fields) => {

	const user = await getUserRecord(userId);

	// check whether the user is trying to upgrade their kyc level
	const upgradeKycLevel = fields.kycLevel && fields.kycLevel > user.kyc_level;
	const kycLevel = fields.kycLevel || user.kyc_level;

	if(fields.kycLevel && fields.kycLevel <= user.kyc_level){
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `The KYC level provided (${fields.kycLevel}) must be higher than your current KYC level (${user.kyc_level}).` })
	}

	fields.userType = user.user_type;

	const acceptedFields = userAcceptedFieldsMap[user.user_type]?.[kycLevel];
	const requiredFields = upgradeKycLevel ? userRequiredFieldsMap[user.user_type]?.[kycLevel] : [];

	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
	if (missingFields.length > 0 || invalidFields.length > 0) {
		throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
	}
		
	// check ip address
	if (fields.ipAddress) {		
		const {ipValid, message} = await ipCheck(fields.ipAddress);
		if (!ipValid) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `Invalid ipAddress, ${message}`, missingFields: [], invalidFields: ["ipAddress"] });
	}

	// check if the ultimate beneficial owners are valid
	if (user.user_type == "business" && fields.ultimateBeneficialOwners) {
		const UBORequiredFields = userRequiredFieldsMap.ubo[kycLevel];
		const UBOAcceptedFields = userAcceptedFieldsMap.ubo[kycLevel];

		// at least one UBO have isSigner and one UBO have hasControl
		let isSignerExists = false
		let hasControlExists = false
		fields.ultimateBeneficialOwners.map((owner, index) => {
			// check UBO field values
			const { missingFields, invalidFields } = fieldsValidation(owner, UBORequiredFields, UBOAcceptedFields);
			if (missingFields.length > 0 || invalidFields.length > 0) {
				throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: `Fields of ultimateBeneficialOwner[${index}] provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields });
			}
			// check if isSigner and hasControl exists
			if (owner.isSigner) isSignerExists = true
			if (owner.hasControl) hasControlExists = true
		})
		if (!isSignerExists) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: "At least one ultimateBeneficialOwners must have isSigner set to true", missingFields: [], invalidFields: ["isSigner"] });
		if (!hasControlExists) throw new InformationUploadError(InformationUploadErrorType.INVALID_FIELD, 400, "", { error: "At least one ultimateBeneficialOwners must have hasControl set to true", missingFields: [], invalidFields: ["hasControl"] });
	}

	// STEP 1: Save the updated fields to the user_kyc table
	// upload file
	await saveUserFiles(userId, fields);

	if(upgradeKycLevel){
		await updateUserRecord(userId, { kyc_level: fields.kycLevel });
	}

	await updateUserKycRecord(userId, fieldsToColumnsMap(fields, userKycColumnsMap));

	await updateUboData(userId, fields.ultimateBeneficialOwners);

}

const ipCheck = async (ip) => {
    // check if ip is valid IPv4.
    if (!isValidIPv4(ip))
        return {ipAllowed: false, ipValid: false, message: "please make sure IP address provided is a public IPv4."}

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
			return {ipAllowed: false, ipValid: false, message: "unable to determine the geographic location from the provided IP address. "}
		}
		if (sanctionedCountries.includes(locationData.country.iso_code)) {
			return {ipAllowed: false, ipValid: false, message: "country information could not be retrieved for the provided IP address."}
		}
		if (locationData.country.iso_code == "US") {
            if (!locationData.subdivisions || !isArray(locationData.subdivisions))
                return {ipAllowed: false, ipValid: false, message: "state/province information could not be retrieved for the provided IP address."}
            else if (!allowedUsState.includes(locationData.subdivisions[0]['iso_code']))
                return {ipAllowed: false, ipValid: true, message: "please make sure provided IP address is not from unsupported area. (https://docs.hifibridge.com/reference/supported-regionscountries)"}
        }
	} else if (locationRes.status === 401) {
		console.error(locationData)
		await createLog("user/util/ipCheck", null, "failed to get ip information", locationData.error)
        
        if (locationData.code === "IP_ADDRESS_RESERVED")
            return {ipAllowed: false, ipValid: false, message: "the provided IP address is a reserved (private, multicast, etc)."}

        return {ipAllowed: false, ipValid: false, message: "the provided IP address is invalid."}
		
	} else {
		console.error(locationData)
		await createLog("user/util/ipCheck", null, "failed to get ip information", locationData.error)
        return {ipAllowed: false, ipValid: false, message: "the provided IP address is invalid."}
    }

	return {isIpAllowed: true, ipValid: true, message: ""}
};


module.exports = {
	InformationUploadError,
	ipCheck,
	informationUploadForCreateUser,
	informationUploadForUpdateUser,
	fieldsToColumnsMap
}