const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const updateBastionUser = require("../util/bastion/main/updateBastionUser")
const createAndFundBastionUser = require('../util/bastion/main/createAndFundBastionUser');
const createLog = require('../util/logger/supabaseLogger');
const { createIndividualBridgeCustomer } = require('../util/bridge/endpoint/submitIndividualBridgeCustomerApplication')
const { createBusinessBridgeCustomer } = require('../util/bridge/endpoint/submitBusinessBridgeCustomerApplication')
const { createToSLink } = require("../util/bridge/endpoint/createToSLink_dep");
const { supabaseCall } = require('../util/supabaseWithRetry');
const { createCheckbookUser } = require('../util/checkbook/endpoint/createCheckbookUser');
const { isFieldsForIndividualCustomerValid, isRequiredFieldsForIndividualCustomerProvided, informationUploadForUpdateUser, informationUploadForCreateUser, ipCheck } = require("../util/user/createUser");
const { InformationUploadError } = require('../util/user/errors');
const { isUUID, fieldsValidation } = require('../util/common/fieldsValidation');
const { updateIndividualBridgeCustomer } = require('../util/bridge/endpoint/updateIndividualBridgeCustomer');
const { updateBusinessBridgeCustomer } = require('../util/bridge/endpoint/updateBusinessBridgeCustomer');
const { updateCheckbookUser } = require('../util/checkbook/endpoint/updateCheckbookUser');
const { generateNewSignedAgreementRecord, updateSignedAgreementRecord, checkSignedAgreementId, checkToSTemplate } = require('../util/user/signedAgreement');
const getAllUsers = require('../util/user/getAllUsers');
const { CustomerStatus } = require('../util/user/common');
const createJob = require('../../asyncJobs/createJob');
const { getRawUserObject } = require('../util/user/getRawUserObject');
const { Chain, currencyContractAddress, hifiSupportedChain } = require('../util/common/blockchain');
const { getBastionWallet } = require('../util/bastion/utils/getBastionWallet');
const { inStringEnum, isValidUrl, isHIFISupportedChain, isInRange, isValidDate } = require('../util/common/filedValidationCheckFunctions');
const notifyUserStatusUpdate = require('../../webhooks/user/notifyUserStatusUpdate');
const { createBastionDeveloperUserWithType } = require('../util/bastion/main/createBastionUserForDeveloperUser');
const { updateUserWallet } = require('../util/user/updateUserWallet');
const { createUserWallet } = require('../util/user/createUserWallet');
const { getUserWalletBalance, getUserWallet } = require('../util/user/getUserWallet');
const { defaultKycInfo, updateKycInfo, KycLevel } = require('../util/user/kycInfo');
const { getUserRecord, updateUserRecord } = require('../util/user/userService');

exports.getPing = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	return res.status(200).json({ message: 'pong' });
};

exports.createHifiUser = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	let userId
	const profileId = req.query.profileId
	const fields = req.body
	try {

		if (!profileId) {
			return res.status(401).json({ error: 'Unauthorized, please input valid api key' });
		}

		// upload information and create new user
		try {
			userId = await informationUploadForCreateUser(profileId, fields)
		} catch (error) {
			if (error instanceof InformationUploadError) {
				return res.status(error.status).json(error.rawResponse)
			}
			await createLog("user/create/informationUploadForCreateUser", null, `Failed to Information Upload For Create User profile Id: ${profileId}, error: ${error.message}`, error, profileId, res)
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}

		// create customer object for providers
		// Determine the Bridge function based on user type
		const bridgeFunction = fields.userType === "individual"
			? createIndividualBridgeCustomer
			: createBusinessBridgeCustomer;

		// Create customer objects for providers
		const [walletResult, bridgeResult, checkbookResult] = await Promise.all([
			createUserWallet(userId, "INDIVIDUAL"),
			bridgeFunction(userId),
			createCheckbookUser(userId),
		]);

		// base response
		const createHifiUserResponse = defaultKycInfo(userId, fields.kycLevel); // this is the new KYC info structure we want our users to slowly migrate to
		updateKycInfo(createHifiUserResponse, walletResult, bridgeResult, checkbookResult);

		let status
		// determine the status code to return to the client
		if (checkbookResult.status === 200 && bridgeResult.status === 200 && walletResult.status === 200) {
			status = 200
		} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || walletResult.status == 500) {
			status = 500;
		} else {
			status = 400;
		}

		// send webhookmessage if sandbox
		if (process.env.NODE_ENV === "development") await notifyUserStatusUpdate(userId)

		return res.status(status).json(createHifiUserResponse);
	} catch (error) {
		await createLog("user/create", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.getHifiUser = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { userId, profileId } = req.query
	try {
		//invalid user_id
		if (!isUUID(userId)) return res.status(404).json({ error: "User not found for provided userId" })
		// get status
		const { status, getHifiUserResponse } = await getRawUserObject(userId, profileId)
		return res.status(status).json(getHifiUserResponse);
	} catch (error) {
		console.error(error)
		await createLog("user/get", userId, error.message, error, null, res)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.updateHifiUser = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId } = req.query
	const fields = req.body

	try {
		//invalid user_id
		if (!isUUID(userId)) return res.status(404).json({ error: "User not found for provided userId" })

		const user = await getUserRecord(userId);
		if (!user) return res.status(404).json({ error: "User not found for provided userId" })
		// check is developer user
		if (user.is_developer) return res.status(400).json({ error: "This is a developer user account, please use PUT user/developer" })

		// upload all the information
		try {
			await informationUploadForUpdateUser(userId, fields)
		} catch (error) {
			if (error instanceof InformationUploadError) {
				return res.status(error.status).json(error.rawResponse)
			}
			await createLog("user/get", userId, `Failed to Information Upload For Update User user Id: ${userId}`, error, null, res)
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}
		// STEP 2: Update the 3rd party providers with the new information

		const kycLevel = fields.kycLevel || user.kyc_level;

		// if the user is an individual, update the individual bridge customer
		// if the user is a business, update the business bridge customer
		let bridgeFunction
		if (user.user_type === "individual") {
			bridgeFunction = updateIndividualBridgeCustomer;
		} else if (user.user_type === "business") {
			bridgeFunction = updateBusinessBridgeCustomer;
		} else {
			return res.status(500).json({ error: "User type not found for provided userId" })
		}

		// NOTE: in the future we may want to determine which 3rd party calls to make based on the fields that were updated, but lets save that for later
		// update customer object for providers
		const [walletResult, bridgeResult, checkbookResult] = await Promise.all([
			updateUserWallet(userId),
			bridgeFunction(userId),
			updateCheckbookUser(userId)
		])

		// STEP 3: Update the bridge_customers, checkbook_users, and bastion_users tables with the new information

		// STEP 4: Contruct the response object based on the responses from the 3rd party providers
		const updateHifiUserResponse = defaultKycInfo(userId, kycLevel);
		updateKycInfo(updateHifiUserResponse, walletResult, bridgeResult, checkbookResult);

		let status
		// determine the status code to return to the client
		if (checkbookResult.status === 200 && bridgeResult.status === 200 && walletResult.status === 200) {
			status = 200
		} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || walletResult.status == 500) {
			status = 500;
		} else {
			status = 400;
		}


		return res.status(status).json(updateHifiUserResponse);
	} catch (error) {
		console.log(error)
		await createLog("user/update", userId, error.message, error, null, res)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.getAllHifiUser = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const fields = req.query
	const { profileId, limit, createdAfter, createdBefore, userType, userId } = fields
	const requiredFields = []
	const acceptedFields = {
		limit: (value) => isInRange(value, 1, 100),
		createdAfter: (value) => isValidDate(value, "ISO"),
		createdBefore: (value) => isValidDate(value, "ISO"),
		userType: (value) => inStringEnum(value, ["individual", "business"]),
		userId: "string"
	}
	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		if (userId && !isUUID(userId)) return res.status(404).json({ error: "User not found" })
		const users = await getAllUsers(userId, profileId, userType, limit, createdAfter, createdBefore)
		return res.status(200).json({ count: users.length, users })
	} catch (error) {
		console.error(error)
		await createLog("user/getAllHifiUser", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.generateToSLink = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const DASHBOARD_URL = process.env.DASHBOARD_URL
	const { profileId } = req.query
	let { redirectUrl, idempotencyKey, templateId } = req.body

	const requiredFields = ["idempotencyKey"]
	const acceptedFields = {
		idempotencyKey: (value) => isUUID(value),
		redirectUrl: (value) => isValidUrl(value),
		templateId: "string"
	}
	try {
		const { missingFields, invalidFields } = fieldsValidation(req.body, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		const env = process.env.NODE_ENV
		// fallback to HIFI template
		if (!templateId) templateId = "2fb2da24-472a-4e5b-b160-038d9dc82a40"
		// check is template exist
		if (!(await checkToSTemplate(templateId))) return res.status(400).json({ error: "templateId does not exist" })
		let encodedUrl
		if (redirectUrl) {
			encodedUrl = `&redirectUrl=${encodeURIComponent(redirectUrl)}`
		} else {
			encodedUrl = ""
		}
		// check is idempotencyKey already exist
		const { isValid, isExpired, data } = await checkSignedAgreementId(idempotencyKey)
		if (isExpired) return res.status(400).json({ error: "Session expired, please generate with new idempotencyKey" })
		if (!isValid) return res.status(400).json({ error: "Invalid or used idempotencyKey" })
		// valid and unexpired record
		if (data) {
			let tosLink = `${DASHBOARD_URL}/accept-terms-of-service?sessionToken=${data.session_token}${encodedUrl}`
			if (env == "development") {
				tosLink += "&sandbox=true"
			}
			return res.status(200).json({ url: tosLink })
		}

		// insert signed agreement record 
		const signedAgreementInfo = await generateNewSignedAgreementRecord(idempotencyKey, templateId)
		// generate hosted tos page
		let tosLink = `${DASHBOARD_URL}/accept-terms-of-service?sessionToken=${signedAgreementInfo.session_token}${encodedUrl}&templateId=${templateId}`
		if (env == "development") {
			tosLink += "&sandbox=true"
		}

		return res.status(200).json({ url: tosLink, signedAgreementId: idempotencyKey })
	} catch (error) {
		await createLog("user/generateToSLink", null, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.acceptToSLink = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId } = req.query
	const { sessionToken, isSandbox } = req.body
	const requiredFields = ["sessionToken"]
	const acceptedFields = {
		sessionToken: (value) => isUUID(value),
		isSandbox: "boolean"
	}
	try {
		const { missingFields, invalidFields } = fieldsValidation(req.body, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		const env = isSandbox ? "development" : "production"
		const signedAgreementId = await updateSignedAgreementRecord(sessionToken, env)
		if (!signedAgreementId) return res.status(400).json({ error: "Session token is invalid" })


		return res.status(200).json({ signedAgreementId })


	} catch (error) {
		await createLog("user/acceptToSLink", null, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

/**
 * This is an experimental function which only upload user's kyc information to the database 
 * then create async job for submit bridgeKyc, createCheckbook and createBastion
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
exports.createHifiUserAsync = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	let userId
	const profileId = req.query.profileId
	const fields = req.body
	try {

		if (!profileId) {
			return res.status(401).json({ error: 'Unauthorized, please input valid api key' });
		}

		// upload information and create new user
		try {
			userId = await informationUploadForCreateUser(profileId, fields)
		} catch (error) {
			if (error instanceof InformationUploadError) {
				return res.status(error.status).json(error.rawResponse)
			}
			await createLog("user/createHifiUserAsync", null, `Failed to upload information for CreateUser for profile Id ${profileId}`, error, profileId, res)
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}

		const createHifiUserResponse = defaultKycInfo(userId, fields.kycLevel);
		createHifiUserResponse.user.kyc.status = CustomerStatus.PENDING
		createHifiUserResponse.onChain.wallet.status = CustomerStatus.PENDING

		// insert async jobs
		await createJob("createUser", { userId, userType: fields.userType }, userId, profileId)
		return res.status(200).json(createHifiUserResponse)

	} catch (error) {
		await createLog("user/createHifiUserAsync", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
}

/**
 * This is an experimental function which only update user's kyc information to the database 
 * then create async job for submit bridgeKyc, createCheckbook and createBastion
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
exports.updateHifiUserAsync = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, profileId } = req.query
	const fields = req.body

	try {

		//invalid user_id
		if (!isUUID(userId)) return res.status(404).json({ error: "User not found for provided userId" })

		const user = await getUserRecord(userId);
		if (!user) return res.status(404).json({ error: "User not found for provided userId" })
		// check is developer user
		if (user.is_developer) return res.status(400).json({ error: "This is a developer user account, please use PUT user/developer" })
		// upload all the information
		try {
			await informationUploadForUpdateUser(userId, fields)
		} catch (error) {
			if (error instanceof InformationUploadError) {
				return res.status(error.status).json(error.rawResponse)
			}
			await createLog("user/updateHifiUserAsync", userId, `Failed to update information for user Id: ${userId}`, error, null, res)
			return res.status(500).json({ error: "Unexpected error happened" })
		}

		const kycLevel = fields.kycLevel || user.kyc_level;
		const updateHifiUserResponse = defaultKycInfo(userId, kycLevel);

		// insert async jobs
		await createJob("updateUser", { userId, userType: user.user_type }, userId, profileId)

		return res.status(200).json(updateHifiUserResponse);
	} catch (error) {
		await createLog("user/updateHifiUserAsync", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.getUserKycInformation = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { userId, profileId } = req.query

	try {

		const { data: user, error: userError } = await supabase
			.from("users")
			.select("user_type, kyc_level, user_kyc(*), ultimate_beneficial_owners(*)")
			.eq("id", userId)
			.maybeSingle()
		if (userError) console.error(userError)
		if (!user) return res.status(404).json({ error: `user not found for id: ${userId}` })

		const result = {
			user: {
				user_type: user.user_type,
				kyc_level: user.kyc_level
			},
			...user.user_kyc,
			ultimate_beneficial_owners: user.ultimate_beneficial_owners
		}

		return res.status(200).json(result)


	} catch (error) {
		await createLog("user/getUserKycInformation", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: `Unexpected error happened` })
	}
}

exports.createDeveloperUser = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	let userId
	const profileId = req.query.profileId
	const fields = req.body
	try {
		// user type should always be business
		// if (fields.userType != "business") return res.status(400).json({error: "Developer user type must be bsuiness"})
		if (fields.userType != "individual") return res.status(400).json({ error: "Developer user type must be individual for the current statge, will be switched to business" })
		// check if developer user is already created
		const { data: profile, error: profileError } = await supabaseCall(() => supabase
			.from("profiles")
			.select("*")
			.eq("id", profileId)
			.single()
		)
		if (profile.developer_user_id) return res.status(400).json({ error: "Developer user is already created" })
		// upload information and create new user
		try {
			userId = await informationUploadForCreateUser(profileId, fields)
		} catch (error) {
			if (error instanceof InformationUploadError) {
				return res.status(error.status).json(error.rawResponse)
			}
			await createLog("user/create", null, error.message, error, profileId, res)
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}

		// update developer user id into profile
		const { data, error } = await supabaseCall(() => supabase
			.from("profiles")
			.update({
				developer_user_id: userId,
				fee_collection_enabled: true
			})
			.eq("id", profileId)
		)

		if (error) throw error

		await updateUserRecord(userId, { is_developer: true });

		// userObject
		const createHifiUserResponse = defaultKycInfo(userId, fields.kycLevel);
		createHifiUserResponse.user.kyc.status = CustomerStatus.PENDING

		// insert async jobs
		await createJob("createDeveloperUser", { userId, userType: fields.userType }, userId, profileId)

		return res.status(200).json(createHifiUserResponse)

	} catch (error) {
		await createLog("user/createHifiUserAsync", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
}

exports.getDeveloperUserStatus = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { userId, profileId } = req.query
	try {
		//invalid user_id
		if (!isUUID(userId)) return res.status(404).json({ error: "User not found for provided userId" })
		// check if user is created
		let { data: user, error: userError } = await supabaseCall(() => supabase
			.from('users')
			.select('*')
			.eq("id", userId)
			.eq("profile_id", profileId)
			.maybeSingle()
		)

		if (userError) return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		if (!user) return res.status(200).json({ status: "NOT_CREATED", message: "Developer user is not yet created" })
		// check is developer user
		if (!user.is_developer) return res.status(400).json({ error: "This is not a developer user account, please use GET user" })
		// check if the developeruserCreation is in the job queue, if yes return pending response
		const { status: userStatus, getHifiUserResponse } = await getRawUserObject(userId, profileId, true)

		// get user kyc_information
		const { data: kycInformation, error: kycInformationError } = await supabase
			.from("user_kyc")
			.select("legal_first_name, legal_last_name, compliance_email, compliance_phone")
			.eq("user_id", userId)
			.single()
		if (kycInformationError) throw kycInformationError

		// get user wallet information, only polygon for now
		const { address: feeCollectionWalletAddress } = await getUserWallet(userId, Chain.POLYGON_MAINNET, "FEE_COLLECTION")
		const { address: prefundedWalletAddress } = await getUserWallet(userId, Chain.POLYGON_MAINNET, "PREFUNDED")
		const { address: gasStationWalletAddress } = await getUserWallet(userId, Chain.ETHEREUM_MAINNET, "GAS_STATION")

		const userInformation = {
			legalFirstName: kycInformation.legal_first_name,
			legalLastName: kycInformation.legal_last_name,
			phone: kycInformation.compliance_phone,
			email: kycInformation.compliance_email,
			...getHifiUserResponse,
			wallet: {
				FEE_COLLECTION: {
					POLYGON_MAINNET: feeCollectionWalletAddress
				},
				PREFUNDED: {
					POLYGON_MAINNET: prefundedWalletAddress
				},
				GAS_STATION: gasStationWalletAddress ? {
					ETHEREUM_MAINNET: gasStationWalletAddress
				} : null
			},
		}

		return res.status(200).json({ user: userInformation, status: getHifiUserResponse.user.kyc.status })

	} catch (error) {
		createLog("user/getDeveloperUser", userId, error.message, null, res)
		return res.status(500).json({ status: "INACTIVE", message: "Please contact HIFI for more information" })
	}
}

exports.updateDeveloperUser = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, profileId } = req.query
	const fields = req.body

	try {

		//invalid user_id
		if (!isUUID(userId)) return res.status(404).json({ error: "User not found for provided userId" })
		const user = await getUserRecord(userId);
		if (!user) return res.status(404).json({ error: "User not found for provided userId" })
		// check is developer user
		if (!user.is_developer) return res.status(400).json({ error: "This is not a developer user account, please use PUT user" })
		// upload all the information
		try {
			await informationUploadForUpdateUser(userId, fields)
		} catch (error) {
			if (error instanceof InformationUploadError) {
				return res.status(error.status).json(error.rawResponse)
			}
			await createLog("user/updateDeveloperUser", userId, `Failed to Information Upload For Update developer User user Id: ${userId}`, error, null, res)
			return res.status(500).json({ error: "Unexpected error happened" })
		}

		const kycLevel = fields.kycLevel || user.kyc_level;
		const updateHifiUserResponse = defaultKycInfo(userId, kycLevel);

		// insert async jobs
		await createJob("updateDeveloperUser", { userId, userType: user.user_type }, userId, profileId)

		return res.status(200).json(updateHifiUserResponse);
	} catch (error) {
		await createLog("user/updateDeveloperUser", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.getUserWalletBalance = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { userId, chain, currency, profileId, walletType } = req.query
	const requiredFields = ["userId", "chain", "currency"]
	const acceptedFields = {
		userId: "string",
		chain: (value) => isHIFISupportedChain(value),
		currency: "string",
		walletType: (value) => inStringEnum(value, ["FEE_COLLECTION", "PREFUNDED", "GAS_STATION", "INDIVIDUAL"])
	}
	try {
		// fields validation
		const { missingFields, invalidFields } = fieldsValidation(req.query, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		// check is supported currency
		const currencyContract = currencyContractAddress[chain][currency]?.toLowerCase();
		if (!currencyContract && currency !== "gas") return res.status(400).json({ error: `Currency not supported for provided chain` })
		const walletBalance = await getUserWalletBalance(userId, chain, currency, walletType || "INDIVIDUAL")
		return res.status(200).json(walletBalance)

	} catch (error) {
		console.error(error)
		await createLog("user/getUserWalletBalance", userId, error.message, error, null, res)
		return res.status(500).json({ error: 'Internal server error' });
	}

}

exports.createDeveloperUserGasStationWallet = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, profileId } = req.query

	try {
		// check userId 
		if (!isUUID(userId)) return res.status(400).json({ error: `Invalid userId (not uuid)` });
		let { data: user, error: userError } = await supabaseCall(() => supabase
			.from('users')
			.select('*')
			.eq("id", userId)
			.eq("profile_id", profileId)
			.maybeSingle()
		)

		if (userError) return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		if (!user) return res.status(200).json({ error: `Invalid userId (user not found)` })
		// check is developer user
		if (!user.is_developer) return res.status(400).json({ error: "This is not a developer user account" })
		// check if wallet is already created
		// assume ETHEREUM_TESTNET will always be created
		const chain = "ETHEREUM_MAINNET"
		const { walletAddress: walletAddressCheck } = await getBastionWallet(userId, chain, "GAS_STATION")
		if (walletAddressCheck) return res.status(400).json({ "message": "wallet is already created", userId, type: "GAS_STATION", walletAddress: walletAddressCheck })

		// create new Bastion User
		await createBastionDeveloperUserWithType(userId, "GAS_STATION")
		// return wallet information
		const { walletAddress } = await getBastionWallet(userId, chain, "GAS_STATION")
		if (!walletAddress) throw new Error("createBastionDeveloperUserWithType success but can not get wallet information")

		return res.status(200).json({ userId, type: "GAS_STATION", walletAddress })

	} catch (error) {
		await createLog("user/createDeveloperUserGasStationWallet", userId, error.message, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}

exports.getLatestBlindpayReceiver = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId } = req.query

	try {
		if (!userId) return res.status(400).json({ error: 'userId is required' })
		const { data: receiver, error } = await supabase
			.from('blindpay_receivers_kyc')
			.select('*')
			.order('created_at', { ascending: false })
			.eq('user_id', userId)
			.limit(1)
			.maybeSingle();

		if (error) throw error;

		if (!receiver) {
			return res.status(404).json({ error: 'No blindpay receivers found' });
		}

		return res.status(200).json(receiver);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: 'Internal server error' });
	}
}