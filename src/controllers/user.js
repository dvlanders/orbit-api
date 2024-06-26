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
const { isUUID } = require('../util/common/fieldsValidation');
const { updateIndividualBridgeCustomer } = require('../util/bridge/endpoint/updateIndividualBridgeCustomer');
const { updateCheckbookUser } = require('../util/checkbook/endpoint/updateCheckbookUser');
const { generateNewSignedAgreementRecord, updateSignedAgreementRecord, checkSignedAgreementId, checkToSTemplate } = require('../util/user/signedAgreement');
const { v4: uuidv4 } = require("uuid");


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
	try {
		const profileId = req.query.profileId
		const fields = req.body

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
			createLog("user/create", "", error.message, error)
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
			}
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
				achPull: {
					achPullStatus: checkbookResult.usOnRamp.status == Status.INACTIVE || checkbookResult.usOnRamp.status == Status.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
					actionNeeded: {
						actions: [...bridgeResult.usRamp.actions, ...createHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
						fieldsToResubmit: [...bridgeResult.usRamp.fields, ...createHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
					}
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
		createLog("user/create", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.getHifiUser = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { userId } = req.query
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


		// base response
		let getHifiUserResponse = {
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
				id: userId
			}
		}


		const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
			getBastionUser(userId), // TODO: implement this function in utils and import before using it here
			getBridgeCustomer(userId), // TODO: implement this function in utils and import before using it here
			getCheckbookUser(userId) // TODO: implement this function in utils and import before using it here
		])

		// Bastion status
		const wallet = {
			walletStatus: bastionResult.walletStatus,
			walletMessage: bastionResult.message,
			actionNeeded: {
				actions: [...bastionResult.actions, ...getHifiUserResponse.wallet.actionNeeded.actions],
				fieldsToResubmit: [...bastionResult.invalidFileds, ...getHifiUserResponse.wallet.actionNeeded.fieldsToResubmit]
			},
			walletAddress: bastionResult.walletAddress
		}
		getHifiUserResponse.wallet = wallet

		//checkbook status
		const achPull = {
			achPullStatus: checkbookResult.usOnRamp.status,
			actionNeeded: {
				actions: [...checkbookResult.usOnRamp.actions, ...getHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
				fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...getHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
			}
		}
		getHifiUserResponse.ramps.usdAch.onRamp.achPull = achPull

		// bridge status
		// kyc
		const userKyc = {
			status: bridgeResult.customerStatus.status,
			actionNeeded: {
				actions: bridgeResult.customerStatus.actions,
				fieldsToResubmit: bridgeResult.customerStatus.fields,
			}
		}
		getHifiUserResponse.user_kyc = userKyc
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
						actions: [...bridgeResult.usRamp.actions, ...getHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
						fieldsToResubmit: [...bridgeResult.usRamp.fields, ...getHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
					}
				}
			},
			offRamp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.usRamp.actions, ...getHifiUserResponse.ramps.usdAch.offRamp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.usRamp.fields, ...getHifiUserResponse.ramps.usdAch.offRamp.actionNeeded.fieldsToResubmit]
				},
			}
		}
		getHifiUserResponse.ramps.usdAch = usdAch
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
					actions: [...bridgeResult.euRamp.actions, ...getHifiUserResponse.ramps.euroSepa.offRamp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.euRamp.fields, ...getHifiUserResponse.ramps.euroSepa.offRamp.actionNeeded.fieldsToResubmit],
				},
				message: ''
			},
		}
		getHifiUserResponse.ramps.euroSepa = euroSepa



		// determine the status code to return to the client -- copied from createHifiUser, make sure this logic still holds true
		let status
		if (checkbookResult.status === 200 && bridgeResult.status === 200 && bastionResult.status === 200) {
			status = 200
		} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || bastionResult.status == 500) {
			status = 500;
		} else {
			status = 400;
		}


		return res.status(status).json(getHifiUserResponse);
	} catch (error) {
		console.error(error)
		createLog("user/get", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.updateHifiUser = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {

		const { userId } = req.query
		const fields = req.body

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
		// upload all the information
		try {
			await informationUploadForUpdateUser(userId, fields)
		} catch (error) {
			if (! (error instanceof InformationUploadError)){
				createLog("user/utils/informationUploadForUpdateUser", error.message, error)
				return res.status(500).json({error: "Unexpected error happened"})
			}
			return res.status(error.status).json(error.rawResponse)
		}
		// STEP 2: Update the 3rd party providers with the new information

		// NOTE: in the future we may want to determine which 3rd party calls to make based on the fields that were updated, but lets save that for later
		// update customer object for providers
		const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
			updateBastionUser(userId), // TODO: implement this function in utils and import before using it here
			updateIndividualBridgeCustomer(userId), // TODO: implement this function in utils and import before using it here
			updateCheckbookUser(userId) // TODO: implement this function in utils and import before using it here
		])

		// STEP 3: Update the bridge_customers, checkbook_users, and bastion_users tables with the new information

		// STEP 4: Contruct the response object based on the responses from the 3rd party providers
		let updateHifiUserResponse = {
			userID: userId,
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
		const { user_id: userId } = req.query
		console.log(error)
		createLog("user/update", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" });
	}
};

exports.getAllHifiUser = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
}

exports.generateToSLink = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	console.log("generateToSLink")
	try {
		const DASHBOARD_URL = process.env.DASHBOARD_URL
		const { profileId } = req.query
		const { redirectUrl, idempotencyKey, templateId } = req.body

		// Validate idempotencyKey directly using regex for UUID v4
		if (!isUUID(idempotencyKey)) return res.status(404).json({ error: "idempotencyKey must be a uuid v4" })


		if (!templateId) return res.status(400).json({ error: "templateId is required" })
		if (!idempotencyKey) return res.status(400).json({ error: "idempotencyKey is required" })
		// check is template exist
		if (!(await checkToSTemplate(templateId))) return res.status(400).json({ error: "templateId is not exist" })
		const encodedUrl = encodeURIComponent(redirectUrl)
		// check is idempotencyKey already exist
		const { isValid, isExpired, data } = await checkSignedAgreementId(idempotencyKey)
		if (isExpired) return res.status(400).json({ error: "Session expired, please generate with new idempotencyKey" })
		if (!isValid) return res.status(400).json({ error: "Invalid or used idempotencyKey" })
		// valid and unexpired record
		if (data) {
			const tosLink = `${DASHBOARD_URL}/accept-terms-of-service?sessionToken=${signedAgreementInfo.session_token}&redirectUrl=${encodedUrl}`
			return res.status(200).json({ url: tosLink })
		}

		// insert signed agreement record 
		const signedAgreementInfo = await generateNewSignedAgreementRecord(idempotencyKey, templateId)
		// generate hosted tos page
		const tosLink = `${DASHBOARD_URL}/accept-terms-of-service?sessionToken=${signedAgreementInfo.session_token}&redirectUrl=${encodedUrl}&templateId=${templateId}`

		return res.status(200).json({ url: tosLink, sessionToken: signedAgreementInfo.session_token })
	} catch (error) {
		createLog("user/generateToSLink", "", error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.acceptToSLink = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const { profileId } = req.query
		const { sessionToken } = req.body
		if (!sessionToken) return res.status(400).json({ error: "Session token is required" })
		const signedAgreementId = await updateSignedAgreementRecord(sessionToken)
		if (!signedAgreementId) return res.status(400).json({ error: "Session token is invalid" })


		return res.status(200).json({ signedAgreementId })


	} catch (error) {
		createLog("user/acceptToSLink", "", error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

