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
const { isFieldsForIndividualCustomerValid, isRequiredFieldsForIndividualCustomerProvided, informationUploadForUpdateUser, informationUploadForCreateUser, InformationUploadError, ipCheck } = require("../util/user/createUser");
const { uploadFileFromUrl, fileUploadErrorType } = require('../util/supabase/fileUpload');
const getBastionUser = require('../util/bastion/main/getBastionUser');
const getBridgeCustomer = require('../util/bridge/endpoint/getBridgeCustomer');
const getCheckbookUser = require('../util/checkbook/endpoint/getCheckbookUser');
const { isUUID, fieldsValidation } = require('../util/common/fieldsValidation');
const { updateIndividualBridgeCustomer } = require('../util/bridge/endpoint/updateIndividualBridgeCustomer');
const { updateBusinessBridgeCustomer } = require('../util/bridge/endpoint/updateBusinessBridgeCustomer');
const { updateCheckbookUser } = require('../util/checkbook/endpoint/updateCheckbookUser');
const { generateNewSignedAgreementRecord, updateSignedAgreementRecord, checkSignedAgreementId, checkToSTemplate } = require('../util/user/signedAgreement');
const { v4: uuidv4 } = require("uuid");
const getAllUsers = require('../util/user/getAllUsers');
const { CustomerStatus } = require('../util/user/common');
const createJob = require('../../asyncJobs/createJob');
const { getRawUserObject } = require('../util/user/getRawUserObject');
const { jobMapping } = require('../../asyncJobs/jobMapping');
const { createUserAsyncCheck } = require('../../asyncJobs/user/createUser');
const { updateUserAsyncCheck } = require('../../asyncJobs/user/updateUser');
const { createDeveloperUserAsyncCheck } = require('../../asyncJobs/user/createDeveloperUser');
const { Chain } = require('../util/common/blockchain');
const { getBastionWallet } = require('../util/bastion/utils/getBastionWallet');
const { updateDeveloperUserAsyncCheck } = require('../../asyncJobs/user/updateDeveloperUser');


const Status = {
	ACTIVE: "ACTIVE",
	INACTIVE: "INACTIVE",
	PENDING: "PENDING",
}

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
			await createLog("user/create", null, `Failed to Information Upload For Create User profile Id: ${profileId}`, error, profileId)
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}

		// base response
		let createHifiUserResponse = {
			wallet: {
				walletStatus: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: "",
				walletAddress: {}
			},
			user_kyc: {
				status: Status.INACTIVE, // represent bridge
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: '',
			},
			ramps: {
				usdAch: {
					onRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: '',
						achPull: {
							achPullStatus: Status.INACTIVE, //represent bridge + checkbook
							actionNeeded: {
								actions: [],
								fieldsToResubmit: [],
							},

						},
					},
					offRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
			},
			user: {
				id: userId,
			}
		}

		// create customer object for providers
		// Determine the Bridge function based on user type
		const bridgeFunction = fields.userType === "individual"
			? createIndividualBridgeCustomer
			: createBusinessBridgeCustomer;

		// Create customer objects for providers
		const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
			createAndFundBastionUser(userId),
			bridgeFunction(userId),
			createCheckbookUser(userId)
		]);

		// Create the Bastion user w/ wallet addresses. Fund the polygon wallet.
		// Submit Bastion kyc
		// Bastion status
		const wallet = {
			walletStatus: bastionResult.walletStatus,
			walletMessage: bastionResult.message,
			actionNeeded: {
				actions: [...bastionResult.actions, ...createHifiUserResponse.wallet.actionNeeded.actions],
				fieldsToResubmit: [...bastionResult.invalidFileds, ...createHifiUserResponse.wallet.actionNeeded.fieldsToResubmit]
			},
			walletAddress: bastionResult.walletAddress
		}
		createHifiUserResponse.wallet = wallet

		//checkbook status
		const achPull = {
			achPullStatus: checkbookResult.usOnRamp.status,
			actionNeeded: {
				actions: [...checkbookResult.usOnRamp.actions, ...createHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
				fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...createHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
			},
			message: checkbookResult.message
		}
		createHifiUserResponse.ramps.usdAch.onRamp.achPull = achPull

		// bridge status
		// kyc
		const userKyc = {
			status: bridgeResult.customerStatus.status,
			actionNeeded: {
				actions: bridgeResult.customerStatus.actions,
				fieldsToResubmit: bridgeResult.customerStatus.fields,
			},
			message: bridgeResult.message,
		}
		createHifiUserResponse.user_kyc = userKyc
		// usRamp
		const usdAch = {
			onRamp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: bridgeResult.customerStatus.actions,
					fieldsToResubmit: bridgeResult.customerStatus.fields
				},
				message: bridgeResult.message,
				achPull: {
					achPullStatus: checkbookResult.usOnRamp.status == Status.INACTIVE || checkbookResult.usOnRamp.status == Status.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
					actionNeeded: {
						actions: [...bridgeResult.usRamp.actions, ...createHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
						fieldsToResubmit: [...bridgeResult.usRamp.fields, ...createHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
					},
					message: checkbookResult.message
				}
			},
			offRamp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.usRamp.actions, ...createHifiUserResponse.ramps.usdAch.offRamp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.usRamp.fields, ...createHifiUserResponse.ramps.usdAch.offRamp.actionNeeded.fieldsToResubmit]
				},
			}
		}
		createHifiUserResponse.ramps.usdAch = usdAch
		// euRamp
		const euroSepa = {
			onRamp: {
				status: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: 'SEPA onRamp will be available in near future',
			},
			offRamp: {
				status: bridgeResult.euRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.euRamp.actions, ...createHifiUserResponse.ramps.euroSepa.offRamp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.euRamp.fields, ...createHifiUserResponse.ramps.euroSepa.offRamp.actionNeeded.fieldsToResubmit],
				},
				message: ''
			},
		}
		createHifiUserResponse.ramps.euroSepa = euroSepa


		let status
		// determine the status code to return to the client
		if (checkbookResult.status === 200 && bridgeResult.status === 200 && bastionResult.status === 200) {
			status = 200
		} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || bastionResult.status == 500) {
			status = 500;
		} else {
			status = 400;
		}


		return res.status(status).json(createHifiUserResponse);
	} catch (error) {
		await createLog("user/create", userId, error.message, error, profileId)
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
		// check if user is created
		let { data: user, error: userError } = await supabaseCall(() => supabase
			.from('users')
			.select('*')
			.eq("id", userId)
			.maybeSingle()
		)

		if (userError) return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		if (!user) return res.status(404).json({ error: "User not found for provided userId" })

		// check is developer user
		if (user.is_developer) return res.status(400).json({ error: "This is a developer user account, please use GET user/developer" })

		// get status
		const { status, getHifiUserResponse } = await getRawUserObject(userId, profileId)


		return res.status(status).json(getHifiUserResponse);
	} catch (error) {
		console.error(error)
		await createLog("user/get", userId, error.message, error)
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
		// check if user is created
		let { data: user, error: userError } = await supabaseCall(() => supabase
			.from('users')
			.select('*')
			.eq("id", userId)
			.maybeSingle()
		)
		if (userError) return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
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
			await createLog("user/get", userId, `Failed to Information Upload For Update User user Id: ${userId}`, error)
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}
		// STEP 2: Update the 3rd party providers with the new information


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
		const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
			updateBastionUser(userId), // TODO: implement this function in utils and import before using it here
			bridgeFunction(userId), // TODO: implement this function in utils and import before using it here
			updateCheckbookUser(userId) // TODO: implement this function in utils and import before using it here
		])

		// STEP 3: Update the bridge_customers, checkbook_users, and bastion_users tables with the new information

		// STEP 4: Contruct the response object based on the responses from the 3rd party providers
		let updateHifiUserResponse = {
			user: {
				id: userId
			},
			wallet: {
				walletStatus: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: "",
				walletAddress: {}
			},
			user_kyc: {
				status: Status.INACTIVE, // represent bridge
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: '',
			},
			ramps: {
				usdAch: {
					onRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: '',
						achPull: {
							achPullStatus: Status.INACTIVE, //represent bridge + checkbook
							actionNeeded: {
								actions: [],
								fieldsToResubmit: [],
							},
						},
					},
					offRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
			},
		}

		// Bastion status
		const wallet = {
			walletStatus: bastionResult.walletStatus,
			walletMessage: bastionResult.message,
			actionNeeded: {
				actions: [...bastionResult.actions, ...updateHifiUserResponse.wallet.actionNeeded.actions],
				fieldsToResubmit: [...bastionResult.invalidFileds, ...updateHifiUserResponse.wallet.actionNeeded.fieldsToResubmit]
			},
			walletAddress: bastionResult.walletAddress
		}
		updateHifiUserResponse.wallet = wallet

		//checkbook status
		const achPull = {
			achPullStatus: checkbookResult.usOnRamp.status,
			actionNeeded: {
				actions: [...checkbookResult.usOnRamp.actions, ...updateHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
				fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...updateHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
			}
		}
		updateHifiUserResponse.ramps.usdAch.onRamp.achPull = achPull

		// bridge status
		// kyc
		const userKyc = {
			status: bridgeResult.customerStatus.status,
			actionNeeded: {
				actions: bridgeResult.customerStatus.actions,
				fieldsToResubmit: bridgeResult.customerStatus.fields,
			},
			message: bridgeResult.message,
		}
		updateHifiUserResponse.user_kyc = userKyc
		// usRamp
		const usdAch = {
			onRamp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: bridgeResult.customerStatus.actions,
					fieldsToResubmit: bridgeResult.customerStatus.fields
				},
				achPull: {
					achPullStatus: checkbookResult.usOnRamp.status == Status.INACTIVE || checkbookResult.usOnRamp.status == Status.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
					actionNeeded: {
						actions: [...bridgeResult.usRamp.actions, ...updateHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
						fieldsToResubmit: [...bridgeResult.usRamp.fields, ...updateHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
					}
				}
			},
			offRamp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.usRamp.actions, ...updateHifiUserResponse.ramps.usdAch.offRamp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.usRamp.fields, ...updateHifiUserResponse.ramps.usdAch.offRamp.actionNeeded.fieldsToResubmit]
				},
			}
		}
		updateHifiUserResponse.ramps.usdAch = usdAch
		// euRamp
		const euroSepa = {
			onRamp: {
				status: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: 'SEPA onRamp will be available in near future',
			},
			offRamp: {
				status: bridgeResult.euRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.euRamp.actions, ...updateHifiUserResponse.ramps.euroSepa.offRamp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.euRamp.fields, ...updateHifiUserResponse.ramps.euroSepa.offRamp.actionNeeded.fieldsToResubmit],
				},
				message: ''
			},
		}
		updateHifiUserResponse.ramps.euroSepa = euroSepa

		let status
		// determine the status code to return to the client
		if (checkbookResult.status === 200 && bridgeResult.status === 200 && bastionResult.status === 200) {
			status = 200
		} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || bastionResult.status == 500) {
			status = 500;
		} else {
			status = 400;
		}


		return res.status(status).json(updateHifiUserResponse);
	} catch (error) {
		console.log(error)
		await createLog("user/update", userId, error.message, error)
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
	const acceptedFields = { limit: "string", createdAfter: "string", createdBefore: "string", userType: "string", userId: "string" }
	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.lenght > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })
		if (limit && limit > 100) return res.status(400).json({ error: "At most request 100 users at a time" })
		if (userId && !isUUID(userId)) return res.status(404).json({ error: "User not found" })
		const users = await getAllUsers(userId, profileId, userType, limit, createdAfter, createdBefore)
		return res.status(200).json({ count: users.length, users })
	} catch (error) {
		console.error(error)
		await createLog("user/getAllHifiUser", userId, error.message, error, profileId)
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

	try {
		const env = process.env.NODE_ENV
		// Validate idempotencyKey directly using regex for UUID v4
		if (!isUUID(idempotencyKey)) return res.status(404).json({ error: "idempotencyKey must be a uuid v4" })

		// fallback to HIFI template
		if (!templateId) templateId = "2fb2da24-472a-4e5b-b160-038d9dc82a40"
		if (!idempotencyKey) return res.status(400).json({ error: "idempotencyKey is required" })
		// check is template exist
		if (!(await checkToSTemplate(templateId))) return res.status(400).json({ error: "templateId is not exist" })
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
			if (env == "development"){
				tosLink += "&sandbox=true"
			}
			return res.status(200).json({ url: tosLink })
		}

		// insert signed agreement record 
		const signedAgreementInfo = await generateNewSignedAgreementRecord(idempotencyKey, templateId)
		// generate hosted tos page
		let tosLink = `${DASHBOARD_URL}/accept-terms-of-service?sessionToken=${signedAgreementInfo.session_token}${encodedUrl}&templateId=${templateId}`
		if (env == "development"){
			tosLink += "&sandbox=true"
		}

		return res.status(200).json({ url: tosLink, signedAgreementId: idempotencyKey })
	} catch (error) {
		await createLog("user/generateToSLink", null, error.message, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.acceptToSLink = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId } = req.query
	const { sessionToken, isSandbox } = req.body
	try {
		const env = isSandbox? "development" : "production"
		console.log(env)
		if (!sessionToken) return res.status(400).json({ error: "Session token is required" })
		const signedAgreementId = await updateSignedAgreementRecord(sessionToken, env)
		if (!signedAgreementId) return res.status(400).json({ error: "Session token is invalid" })


		return res.status(200).json({ signedAgreementId })


	} catch (error) {
		await createLog("user/acceptToSLink", null, error.message, error, profileId)
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
			await createLog("user/createHifiUserAsync", null, `Failed to Information Upload For CreateUser for profile Id ${profileId}`, error, profileId)
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}

		let createHifiUserResponse = {
			wallet: {
				walletStatus: CustomerStatus.PENDING,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: "",
				walletAddress: {}
			},
			user_kyc: {
				status: CustomerStatus.PENDING, // represent bridge
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: '',
			},
			ramps: {
				usdAch: {
					onRamp: {
						status: CustomerStatus.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: '',
						achPull: {
							achPullStatus: CustomerStatus.PENDING, //represent bridge + checkbook
							actionNeeded: {
								actions: [],
								fieldsToResubmit: [],
							},

						},
					},
					offRamp: {
						status: CustomerStatus.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offRamp: {
						status: CustomerStatus.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
			},
			user: {
				id: userId,
			}
		}

		// insert async jobs
		const canSchedule = await createUserAsyncCheck("createUser", { userId, userType: fields.userType }, userId, profileId)
		if (!canSchedule) return res.status(200).json(createHifiUserResponse)
		await createJob("createUser", { userId, userType: fields.userType }, userId, profileId)

		return res.status(200).json(createHifiUserResponse)

	} catch (error) {
		await createLog("user/createHifiUserAsync", userId, error.message, error, profileId)
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
		// check if user is created
		let { data: user, error: userError } = await supabaseCall(() => supabase
			.from('users')
			.select('*')
			.eq("id", userId)
			.maybeSingle()
		)
		if (userError) return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
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
			await createLog("user/updateHifiUserAsync", userId, `Failed to Information Upload For Update User user Id: ${userId}`, error)
			return res.status(500).json({ error: "Unexpected error happened" })
		}

		let updateHifiUserResponse = {
			user: {
				id: userId
			},
			wallet: {
				walletStatus: Status.PENDING,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: "",
				walletAddress: {}
			},
			user_kyc: {
				status: Status.PENDING, // represent bridge
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: '',
			},
			ramps: {
				usdAch: {
					onRamp: {
						status: Status.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: '',
						achPull: {
							achPullStatus: Status.PENDING, //represent bridge + checkbook
							actionNeeded: {
								actions: [],
								fieldsToResubmit: [],
							},
						},
					},
					offRamp: {
						status: Status.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offRamp: {
						status: Status.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
			},
		}

		// insert async jobs
		const canSchedule = await updateUserAsyncCheck("updateUser", { userId, userType: user.user_type }, userId, profileId)
		if (!canSchedule) return res.status(200).json(updateHifiUserResponse)
		await createJob("updateUser", { userId, userType: user.user_type }, userId, profileId)

		return res.status(200).json(updateHifiUserResponse);
	} catch (error) {
		await createLog("user/updateHifiUserAsync", userId, error.message, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.getUserKycInformation = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { userId, profileId } = req.query

	try {
		const { data, error } = await supabase
			.from("user_kyc")
			.select("*, users(user_type)")
			.eq("user_id", userId)
			.maybeSingle()


		if (error) throw error
		if (!data) return res.status(404).json({ error: `user not found for id: ${userId}` })
		return res.status(200).json(data)


	} catch (error) {
		await createLog("user/getUserKycInformation", userId, error.message, error, profileId)
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
			await createLog("user/create", null, error.message, error, profileId)
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}

		let createHifiUserResponse = {
			wallet: {
				walletStatus: CustomerStatus.PENDING,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: "",
				walletAddress: {}
			},
			user_kyc: {
				status: CustomerStatus.PENDING, // represent bridge
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: '',
			},
			ramps: {
				usdAch: {
					onRamp: {
						status: CustomerStatus.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: '',
						achPull: {
							achPullStatus: CustomerStatus.PENDING, //represent bridge + checkbook
							actionNeeded: {
								actions: [],
								fieldsToResubmit: [],
							},

						},
					},
					offRamp: {
						status: CustomerStatus.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offRamp: {
						status: CustomerStatus.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
			},
			user: {
				id: userId,
			}
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

		// update user account type to is_developer
		const { data: user, error: userError } = await supabaseCall(() => supabase
			.from("users")
			.update({
				is_developer: true
			})
			.eq("id", userId)
		)

		if (error) throw error

		// insert async jobs
		const canSchedule = await createDeveloperUserAsyncCheck("createDeveloperUser", { userId, userType: fields.userType }, userId, profileId)
		if (!canSchedule) return res.status(200).json(createHifiUserResponse)
		await createJob("createDeveloperUser", { userId, userType: fields.userType }, userId, profileId)

		return res.status(200).json(createHifiUserResponse)

	} catch (error) {
		await createLog("user/createHifiUserAsync", userId, error.message, error, profileId)
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
		const canScheduled = await createDeveloperUserAsyncCheck("createDeveloperUser", {userId, userType: user.userType}, userId, profileId)
		let status
		let basicKycStatus
		if (!canScheduled){
			status = "PENDING"
		}else{
			// get bridge kyc status
			// check if the application is submitted
			const { data: bridgeCustomer, error: bridgeCustomerError } = await supabaseCall(() => supabase
			.from('bridge_customers')
			.select('*')
			.eq('user_id', userId)
			.maybeSingle()
			)
			if (bridgeCustomerError) throw bridgeCustomerError
			if (!bridgeCustomer) return res.status(500).json({status: "INACTIVE", message: "Please contact HIFI for more information"})
			const bridgeKycPassed = bridgeCustomer.status == "active"

			if (bridgeCustomer.status == "rejected"){
				basicKycStatus = await getBridgeCustomer(userId)
			}

			// get bastion kyc status
			let { data: bastionUser, error: bastionUserError } = await supabaseCall(() => supabase
			.from('bastion_users')
			.select('kyc_passed, jurisdiction_check_passed, kyc_level')
			.eq("bastion_user_id", `${userId}-FEE_COLLECTION`)
			.maybeSingle())

			if (bastionUserError) throw bastionUserError
			if (!bastionUser) return res.status(200).json({status: "INACTIVE", message: "Please contact HIFI for more information"})
			const bastionKycPassed = bastionUser.kyc_passed && bastionUser.jurisdiction_check_passed
			
			// get status
			if (bridgeKycPassed && bastionKycPassed){
				status = "ACTIVE"
			}else if (!bastionKycPassed){
				status = "INACTIVE"
			}else if (bridgeCustomer.status == "not_started"){
				status = "PENDING"
			}else{
				status = "INACTIVE"
			}
		}
		
		// get user kyc_information
		const { data: kycInformation, error: kycInformationError } = await supabase
			.from("user_kyc")
			.select("legal_first_name, legal_last_name, compliance_email, compliance_phone")
			.eq("user_id", userId)
			.single()
		if (kycInformationError) throw kycInformationError

		// get user wallet information, only polygon for now
		const {walletAddress: feeCollectionWalletAddress} = await getBastionWallet(userId, Chain.POLYGON_MAINNET, "FEE_COLLECTION")
		const {walletAddress: prefundedWalletAddress} = await getBastionWallet(userId, Chain.POLYGON_MAINNET, "PREFUNDED")

		const userInformation = {
			legalFirstName: kycInformation.legal_first_name,
			legalLastName: kycInformation.legal_last_name,
			phone: kycInformation.compliance_phone,
			email: kycInformation.compliance_email,
			wallet: {
				FEE_COLLECTION: {
					POLYGON_MAINNET: feeCollectionWalletAddress
				},
				PREFUNDED: {
					POLYGON_MAINNET: prefundedWalletAddress
				}
			}
		}

		return res.status(200).json({ status, user: userInformation, basicKycStatus })


	} catch (error) {
		createLog("user/getDeveloperUser", userId, error.message)
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
		// check if user is created
		let { data: user, error: userError } = await supabaseCall(() => supabase
			.from('users')
			.select('*')
			.eq("id", userId)
			.maybeSingle()
		)
		if (userError) return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
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
			await createLog("user/updateDeveloperUser", userId, `Failed to Information Upload For Update developer User user Id: ${userId}`, error)
			return res.status(500).json({ error: "Unexpected error happened" })
		}

		let updateHifiUserResponse = {
			user: {
				id: userId
			},
			wallet: {
				walletStatus: Status.PENDING,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: "",
				walletAddress: {}
			},
			user_kyc: {
				status: Status.PENDING, // represent bridge
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: '',
			},
			ramps: {
				usdAch: {
					onRamp: {
						status: Status.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: '',
						achPull: {
							achPullStatus: Status.PENDING, //represent bridge + checkbook
							actionNeeded: {
								actions: [],
								fieldsToResubmit: [],
							},
						},
					},
					offRamp: {
						status: Status.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onRamp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offRamp: {
						status: Status.PENDING, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
			},
		}

		// insert async jobs
		const canSchedule = await updateDeveloperUserAsyncCheck("updateDeveloperUser", {userId, userType: user.user_type}, userId, profileId)
        if (!canSchedule) return res.status(200).json(updateHifiUserResponse)
		await createJob("updateDeveloperUser", {userId, userType: user.user_type}, userId, profileId)

		return res.status(200).json(updateHifiUserResponse);
	} catch (error) {
		await createLog("user/updateDeveloperUser", userId, error.message, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};