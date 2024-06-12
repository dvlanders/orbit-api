const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const updateBastionUser = require("../util/bastion/endpoints/updateBastionUser")
const createAndFundBastionUser = require('../util/bastion/endpoints/createAndFundBastionUser');
const createLog = require('../util/logger/supabaseLogger');
const { createIndividualBridgeCustomer } = require('../util/bridge/endpoint/submitIndividualBridgeCustomerApplication')
const { createToSLink } = require("../util/bridge/endpoint/createToSLink_dep");
const { supabaseCall } = require('../util/supabaseWithRetry');
const { createCheckbookUser } = require('../util/checkbook/endpoint/createCheckbookUser');
const { isFieldsForIndividualCustomerValid, isRequiredFieldsForIndividualCustomerProvided, informationUploadForUpdateUser, informationUploadForCreateUser, InformationUploadError, ipCheck } = require("../util/user/createUser");
const { uploadFileFromUrl, fileUploadErrorType } = require('../util/supabase/fileUpload');
const getBastionUser = require('../util/bastion/endpoints/getBastionUser');
const getBridgeCustomer = require('../util/bridge/endpoint/getBridgeCustomer');
const getCheckbookUser = require('../util/checkbook/endpoint/getCheckbookUser');
const { isUUID } = require('../util/common/fieldsValidation');
const { updateIndividualBridgeCustomer } = require('../util/bridge/endpoint/updateIndividualBridgeCustomer');
const { updateCheckbookUser } = require('../util/checkbook/endpoint/updateCheckbookUser');

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

/**
 * @swagger
 * /user/create:
 *   post:
 *     summary: Create user
 *     description: This endpoint creates a new user in Hifi.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               user_type:
 *                 type: string
 *               signed_agreement_id:
 *                 type: string
 *               legal_first_name:
 *                 type: string
 *               legal_last_name:
 *                 type: string
 *               compliance_email:
 *                 type: string
 *               compliance_phone:
 *                 type: string
 *               address_line_1:
 *                 type: string
 *               address_line_2:
 *                 type: string
 *               city:
 *                 type: string
 *               state_province_region:
 *                 type: string
 *               postal_code:
 *                 type: string
 *               country:
 *                 type: string
 *               address_type:
 *                 type: string
 *               tax_identification_number:
 *                 type: string
 *               id_type:
 *                 type: string
 *               gov_id_country:
 *                 type: string
 *               business_name:
 *                 type: string
 *               business_description:
 *                 type: string
 *               business_type:
 *                 type: string
 *               website:
 *                 type: string
 *               source_of_funds:
 *                 type: string
 *               is_dao:
 *                 type: boolean
 *               transmits_customer_funds:
 *                 type: boolean
 *               compliance_screening_explanation:
 *                 type: string
 *               ip_address:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               gov_id_front:
 *                 type: string
 *               gov_id_back:
 *                 type: string
 *               proof_of_residency:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created successfully
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: object
 *                 properties:
 *                   walletStatus: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   walletMessage: string
 *               user_kyc:
 *                 type: object
 *                 properties:
 *                   status: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   message: string
 *               ramps:
 *                 type: object
 *                 properties:
 *                   usdAch:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                           achPull:
 *                             type: object
 *                             properties:
 *                               achPullStatus: string
 *                               actionNeeded: 
 *                                 type: object
 *                                 properties:
 *                                   actions: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                   fieldsToResubmit: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                               achPullMessage: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                   euroSepa:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *               user:
 *                 type: object
 *                 properties:
 *                   id: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 missing_fields:
 *                   type: array
 *                   items:
 *                     type: string
 *       405:
 *         description: Method not allowed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
exports.createHifiUser = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	try {
		// TODO: add all of the variables required for this endpoint to work
		// TODO: add variable rampRegions to the request body. if rampRegions includes EUR, then we collect the additional fields required by bridge

		// Customer profile id, passed from middleware after api key validation
		// const profileId = req.profile.id
		const profileId = "7cdf31e1-eb47-4b43-82f7-e368e3f6197b" // dev only
		const fields = req.body

		if (!profileId) {
			return res.status(401).json({ error: 'Unauthorized, please input valid api key' });
		}

		// upload information and create new user
		let userId
		try{
			userId = await informationUploadForCreateUser(profileId, fields)
		}catch(error){
			if (error instanceof InformationUploadError){
				return res.status(error.status).json(error.rawResponse)
			}
			createLog("user/create", "", error.message, error)
			return res.status(500).json({error: "Unexpected error happened, please contact HIFI for more information"})
		}

		// base response
		let createHifiUserResponse = {
			wallet: {
				walletStatus: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: ""
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
					onramp: {
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
							achPullMessage: ""

						},
					},
					offramp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onramp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offramp: {
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

		// create customer object for providers
		const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
			createAndFundBastionUser(userId),
			createIndividualBridgeCustomer(userId),
			createCheckbookUser(userId)
		])

		// Create the Bastion user w/ wallet addresses. Fund the polygon wallet.
		// Submit Bastion kyc
		// Bastion status
		const wallet = {
			walletStatus: bastionResult.walletStatus,
			walletMessage: bastionResult.message,
			actionNeeded: {
				actions: [...bastionResult.actions, ...createHifiUserResponse.wallet.actionNeeded.actions],
				fieldsToResubmit: [...bastionResult.invalidFileds, ...createHifiUserResponse.wallet.actionNeeded.fieldsToResubmit]
			}
		}
		createHifiUserResponse.wallet = wallet

		//checkbook status
		const achPull = {
			achPullStatus: checkbookResult.usOnRamp.status,
			achPullMessage: [...checkbookResult.message, ...createHifiUserResponse.ramps.usdAch.onramp.achPull.achPullMessage],
			actionNeeded: {
				actions: [...checkbookResult.usOnRamp.actions, ...createHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.actions],
				fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...createHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.fieldsToResubmit]
			}
		}
		createHifiUserResponse.ramps.usdAch.onramp.achPull = achPull

		// bridge status
		// kyc
		const userKyc = {
			status: bridgeResult.customerStatus.status,
			actionNeeded: {
				actions: bridgeResult.customerStatus.actions,
				fieldsToResubmit:  bridgeResult.customerStatus.fields,
			},
			message: bridgeResult.message,
		}
		createHifiUserResponse.user_kyc = userKyc
		// usRamp
		const usdAch = {
			onramp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: bridgeResult.customerStatus.actions,
					fieldsToResubmit: bridgeResult.customerStatus.fields
				},
				achPull:{
					achPullStatus: checkbookResult.usOnRamp.status == Status.INACTIVE || checkbookResult.usOnRamp.status == Status.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
					achPullMessage: [...createHifiUserResponse.ramps.usdAch.onramp.achPull.achPullMessage],
					actionNeeded: {
						actions: [...bridgeResult.usRamp.actions, ...createHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.actions],
						fieldsToResubmit: [...bridgeResult.usRamp.fields, ...createHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.fieldsToResubmit]
					}
				}
			},
			offramp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.usRamp.actions, ...createHifiUserResponse.ramps.usdAch.offramp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.usRamp.fields, ...createHifiUserResponse.ramps.usdAch.offramp.actionNeeded.fieldsToResubmit]
				},
			}
		}
		createHifiUserResponse.ramps.usdAch = usdAch
		// euRamp
		const euroSepa = {
			onramp: {
				status: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: 'SEPA onRamp will be available in near future',
			},
			offramp: {
				status: bridgeResult.euRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.euRamp.actions, ...createHifiUserResponse.ramps.euroSepa.offramp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.euRamp.actions, ...createHifiUserResponse.ramps.euroSepa.offramp.actionNeeded.actions],
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
	}catch (error){
		createLog("user/create", userId, error.message, error)
		return res.status(500).json({error: "Unexpected error happened, please contact HIFI for more information"});
	}
};

/**
 * /user
 * get:
 *   summary: Get user status
 *   description: Get all user status including KYC, ramp, wallet transfer
 *   queryParams:
 *     user_id: string
 *   responses:
 *     200, 400, 500:
 *       description: User status retrieved successfully
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: object
 *                 properties:
 *                   walletStatus: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   walletMessage: string
 *               user_kyc:
 *                 type: object
 *                 properties:
 *                   status: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   message: string
 *               ramps:
 *                 type: object
 *                 properties:
 *                   usdAch:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                           achPull:
 *                             type: object
 *                             properties:
 *                               achPullStatus: string
 *                               actionNeeded: 
 *                                 type: object
 *                                 properties:
 *                                   actions: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                   fieldsToResubmit: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                               achPullMessage: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                   euroSepa:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *               user:
 *                 type: object
 *                 properties:
 *                   id: string
 *     500:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Unexpected error happened, please contact HIFI for more information"
 */
exports.getHifiUser = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	try{
		const { user_id: userId } = req.query
		//invalid user_id
		if (!isUUID(userId)) return res.status(404).json({error: "User not found for provided user_id"})
		// check if user is created
		let { data: user, error: userError } = await supabaseCall(()=> supabase
			.from('users')
			.select('*')
			.eq("id", userId)
			.maybeSingle()
		)

		if (userError) return res.status(500).json({error: "Unexpected error happened, please contact HIFI for more information"})
		if (!user) return res.status(404).json({error: "User not found for provided user_id"})
		

		// base response
		let getHifiUserResponse = {
			wallet: {
				walletStatus: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: ""
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
					onramp: {
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
							achPullMessage: ""

						},
					},
					offramp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onramp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offramp: {
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
			}
		}
		getHifiUserResponse.wallet = wallet

		//checkbook status
		const achPull = {
			achPullStatus: checkbookResult.usOnRamp.status,
			achPullMessage: [...checkbookResult.message, ...getHifiUserResponse.ramps.usdAch.onramp.achPull.achPullMessage],
			actionNeeded: {
				actions: [...checkbookResult.usOnRamp.actions, ...getHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.actions],
				fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...getHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.fieldsToResubmit]
			}
		}
		getHifiUserResponse.ramps.usdAch.onramp.achPull = achPull

		// bridge status
		// kyc
		const userKyc = {
			status: bridgeResult.customerStatus.status,
			actionNeeded: {
				actions: bridgeResult.customerStatus.actions,
				fieldsToResubmit:  bridgeResult.customerStatus.fields,
			}
		}
		getHifiUserResponse.user_kyc = userKyc
		// usRamp
		const usdAch = {
			onramp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: bridgeResult.customerStatus.actions,
					fieldsToResubmit: bridgeResult.customerStatus.fields
				},
				message: bridgeResult.message,
				achPull:{
					achPullStatus: checkbookResult.usOnRamp.status == Status.INACTIVE || checkbookResult.usOnRamp.status == Status.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
					achPullMessage: [...getHifiUserResponse.ramps.usdAch.onramp.achPull.achPullMessage],
					actionNeeded: {
						actions: [...bridgeResult.usRamp.actions, ...getHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.actions],
						fieldsToResubmit: [...bridgeResult.usRamp.fields, ...getHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.fieldsToResubmit]
					}
				}
			},
			offramp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.usRamp.actions, ...getHifiUserResponse.ramps.usdAch.offramp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.usRamp.fields, ...getHifiUserResponse.ramps.usdAch.offramp.actionNeeded.fieldsToResubmit]
				},
			}
		}
		getHifiUserResponse.ramps.usdAch = usdAch
		// euRamp
		const euroSepa = {
			onramp: {
				status: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: 'SEPA onRamp will be available in near future',
			},
			offramp: {
				status: bridgeResult.euRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.euRamp.actions, ...getHifiUserResponse.ramps.euroSepa.offramp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.euRamp.actions, ...getHifiUserResponse.ramps.euroSepa.offramp.actionNeeded.actions],
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
	}catch(error){
		createLog("user/get", userId, error.message, error)
		return res.status(500).json({error: "Unexpected error happened, please contact HIFI for more information"});
	}
};

/**
 * @swagger
 * /user:
 *   put:
 *     summary: update user
 *     description: This endpoint update user information and kyc in Hifi.
 *     queryParams:
 *       user_id: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               user_type:
 *                 type: string
 *               signed_agreement_id:
 *                 type: string
 *               legal_first_name:
 *                 type: string
 *               legal_last_name:
 *                 type: string
 *               compliance_email:
 *                 type: string
 *               compliance_phone:
 *                 type: string
 *               address_line_1:
 *                 type: string
 *               address_line_2:
 *                 type: string
 *               city:
 *                 type: string
 *               state_province_region:
 *                 type: string
 *               postal_code:
 *                 type: string
 *               country:
 *                 type: string
 *               address_type:
 *                 type: string
 *               tax_identification_number:
 *                 type: string
 *               id_type:
 *                 type: string
 *               gov_id_country:
 *                 type: string
 *               business_name:
 *                 type: string
 *               business_description:
 *                 type: string
 *               business_type:
 *                 type: string
 *               website:
 *                 type: string
 *               source_of_funds:
 *                 type: string
 *               is_dao:
 *                 type: boolean
 *               transmits_customer_funds:
 *                 type: boolean
 *               compliance_screening_explanation:
 *                 type: string
 *               ip_address:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               gov_id_front:
 *                 type: string
 *               gov_id_back:
 *                 type: string
 *               proof_of_residency:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created successfully
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: object
 *                 properties:
 *                   walletStatus: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   walletMessage: string
 *               user_kyc:
 *                 type: object
 *                 properties:
 *                   status: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   message: string
 *               ramps:
 *                 type: object
 *                 properties:
 *                   usdAch:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                           achPull:
 *                             type: object
 *                             properties:
 *                               achPullStatus: string
 *                               actionNeeded: 
 *                                 type: object
 *                                 properties:
 *                                   actions: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                   fieldsToResubmit: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                               achPullMessage: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                   euroSepa:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *               user:
 *                 type: object
 *                 properties:
 *                   id: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 missing_fields:
 *                   type: array
 *                   items:
 *                     type: string
 *       405:
 *         description: Method not allowed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
exports.updateHifiUser = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try{
	
		const {user_id: userId} = req.query
		const fields = req.body

		//invalid user_id
		if (!isUUID(userId)) return res.status(404).json({error: "User not found for provided user_id"})
			// check if user is created
			let { data: user, error: userError } = await supabaseCall(()=> supabase
				.from('users')
				.select('*')
				.eq("id", userId)
				.maybeSingle()
			)

		if (userError) return res.status(500).json({error: "Unexpected error happened, please contact HIFI for more information"})
		if (!user) return res.status(404).json({error: "User not found for provided user_id"})

		// upload all the information
		try{
			await informationUploadForUpdateUser(userId, fields)
		}catch (error){
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
			wallet: {
				walletStatus: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				walletMessage: ""
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
					onramp: {
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
							achPullMessage: ""

						},
					},
					offramp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: ''
					},
				},
				euroSepa: {
					onramp: {
						status: Status.INACTIVE, // represent bridge
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
						message: 'SEPA onRamp will be available in near future',
					},
					offramp: {
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

		// Bastion status
		const wallet = {
			walletStatus: bastionResult.walletStatus,
			walletMessage: bastionResult.message,
			actionNeeded: {
				actions: [...bastionResult.actions, ...updateHifiUserResponse.wallet.actionNeeded.actions],
				fieldsToResubmit: [...bastionResult.invalidFileds, ...updateHifiUserResponse.wallet.actionNeeded.fieldsToResubmit]
			}
		}
		updateHifiUserResponse.wallet = wallet

		//checkbook status
		const achPull = {
			achPullStatus: checkbookResult.usOnRamp.status,
			achPullMessage: [...checkbookResult.message, ...updateHifiUserResponse.ramps.usdAch.onramp.achPull.achPullMessage],
			actionNeeded: {
				actions: [...checkbookResult.usOnRamp.actions, ...updateHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.actions],
				fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...updateHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.fieldsToResubmit]
			}
		}
		updateHifiUserResponse.ramps.usdAch.onramp.achPull = achPull

		// bridge status
		// kyc
		const userKyc = {
			status: bridgeResult.customerStatus.status,
			actionNeeded: {
				actions: bridgeResult.customerStatus.actions,
				fieldsToResubmit:  bridgeResult.customerStatus.fields,
			},
			message: bridgeResult.message,
		}
		updateHifiUserResponse.user_kyc = userKyc
		// usRamp
		const usdAch = {
			onramp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: bridgeResult.customerStatus.actions,
					fieldsToResubmit: bridgeResult.customerStatus.fields
				},
				achPull:{
					achPullStatus: checkbookResult.usOnRamp.status == Status.INACTIVE || checkbookResult.usOnRamp.status == Status.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
					achPullMessage: [...updateHifiUserResponse.ramps.usdAch.onramp.achPull.achPullMessage],
					actionNeeded: {
						actions: [...bridgeResult.usRamp.actions, ...updateHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.actions],
						fieldsToResubmit: [...bridgeResult.usRamp.fields, ...updateHifiUserResponse.ramps.usdAch.onramp.achPull.actionNeeded.fieldsToResubmit]
					}
				}
			},
			offramp: {
				status: bridgeResult.usRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.usRamp.actions, ...updateHifiUserResponse.ramps.usdAch.offramp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.usRamp.fields, ...updateHifiUserResponse.ramps.usdAch.offramp.actionNeeded.fieldsToResubmit]
				},
			}
		}
		updateHifiUserResponse.ramps.usdAch = usdAch
		// euRamp
		const euroSepa = {
			onramp: {
				status: Status.INACTIVE,
				actionNeeded: {
					actions: [],
					fieldsToResubmit: [],
				},
				message: 'SEPA onRamp will be available in near future',
			},
			offramp: {
				status: bridgeResult.euRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.euRamp.actions, ...updateHifiUserResponse.ramps.euroSepa.offramp.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.euRamp.actions, ...updateHifiUserResponse.ramps.euroSepa.offramp.actionNeeded.actions],
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
	}catch (error){
		const {user_id: userId} = req.query
		createLog("user/update", userId, error.message, error)
		return res.status(500).json({error: "Unexpected error happened, please contact HIFI for more information"});
	}
};