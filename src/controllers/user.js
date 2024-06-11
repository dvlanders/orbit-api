const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');

const createAndFundBastionUser = require('../util/bastion/endpoints/createAndFundBastionUser');
const createLog = require('../util/logger/supabaseLogger');
const { createIndividualBridgeCustomer } = require('../util/bridge/endpoint/createIndividualBridgeCustomer')
const { createToSLink } = require("../util/bridge/endpoint/createToSLink");
const { supabaseCall } = require('../util/supabaseWithRetry');
const { createCheckbookUser } = require('../util/checkbook/endpoint/createCheckbookUser');
const { isFieldsForIndividualCustomerValid, isRequiredFieldsForIndividualCustomerProvided } = require("../util/user/createUser");
const { uploadFileFromUrl, fileUploadErrorType } = require('../util/supabase/fileUpload');

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

	// TODO: add all of the variables required for this endpoint to work
	// TODO: add variable rampRegions to the request body. if rampRegions includes EUR, then we collect the additional fields required by bridge

	// Customer profile id, passed from middleware after api key validation
	// const profileId = req.profile.id
	const profileId = "7cdf31e1-eb47-4b43-82f7-e368e3f6197b" // dev only
	const fields = req.body

	if (!profileId) {
		return res.status(401).json({ error: 'Unauthorized, please input valid api key' });
	}
	// check if the body is valid
	const invalidField = isFieldsForIndividualCustomerValid(fields)
	if (invalidField) {
		return res.status(400).json({ error: `${invalidField} is not accepted` });
	}

	// check if required fields are uploaded
	const missingFields = isRequiredFieldsForIndividualCustomerProvided(fields)

	if (missingFields && missingFields.length > 0) {
		return res.status(400).json({ error: 'please provide required fields', missing_fields: missingFields });
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
		createLog("user/create", "", error.message, error)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
	}

	// create bridge record and input signed agreement id
	try {
		const { error: newBridgeRecordError } = await supabase
			.from('bridge_customers')
			.insert(
				{ user_id: userId, signed_agreement_id: fields.signed_agreement_id },
			)
			.select()

		if (newBridgeRecordError) throw newBridgeRecordError

	} catch (error) {
		createLog("user/create", "", error.message, error)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
	}

	// base response
	let createHifiUserResponse = {
		wallet: {
			walletStatus: Status.INACTIVE,
			walletActionNeeded: [],
			walletMessage: ""
		},
		user_kyc: {
			status: Status.INACTIVE, // represent bridge
			actionNeeded: {
				fieldsToResubmit: [],
			},
			message: '',
		},
		ramps: {
			usdAch: {
				onramp: {
					status: Status.INACTIVE, // represent bridge
					actionNeeded: {
						fieldsToResubmit: [],
					},
					message: '',
					achPull: {
						achPullStatus: Status.INACTIVE, //represent bridge + checkbook
						achPullActionNeeded: {
							fieldsToResubmit: [],
						},
						achPullMessage: ""

					},
				},
				offramp: {
					status: Status.INACTIVE, // represent bridge
					actionNeeded: {
						fieldsToResubmit: [],
					},
					message: ''
				},
			},
			euroSepa: {
				onramp: {
					status: Status.INACTIVE, // represent bridge
					actionNeeded: {
						fieldsToResubmit: [],
					},
					message: 'SEPA onRamp will be available in near future',
				},
				offramp: {
					status: Status.INACTIVE, // represent bridge
					actionNeeded: {
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

	// upload file
	const files = [
		{
			key: "gov_id_front",
			bucket: "compliance_id"
		},
		{
			key: "gov_id_back",
			bucket: "compliance_id"
		},
		{
			key: "proof_of_residency",
			bucket: "proof_of_residency"
		},

	]
	const paths = {}
	try {
		await Promise.all(files.map(async (file) => {
			if (fields[file.key]) {
				paths[file.key] = await uploadFileFromUrl(fields[file.key], file.bucket, `${userId}/${file.key}`);
			}
		}))

	} catch (error) {
		// TODO: return the correct error to the user regarding incorrect file type and or file siZe
		createLog("user/create", userId, error.message, error)
		if (error.type && (error.type == fileUploadErrorType.FILE_TOO_LARGE || error.type == fileUploadErrorType.INVALID_FILE_TYPE)) {
			return res.status(400).json({ error: error.message })
		}
		// internal server error
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
	}

	// insert info into database
	try {
		//TODO: remove next lines. just enumerate all the inserted fields
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
					gov_id_front_path: paths.gov_id_front,
					gov_id_back_path: paths.gov_id_back,
					proof_of_residency_path: paths.proof_of_residency
				}
			)
			.select()
		)
		if (error) throw error
	} catch (error) {
		createLog("user/create", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
	}

	// create customer object for providers
	const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
		createAndFundBastionUser(userId),
		createIndividualBridgeCustomer(userId),
		createCheckbookUser(userId)
	])

	// Create the Bastion user w/ wallet addresses. Fund the polygon wallet.
	// Submit Bastion kyc
	// should only always be internal server error if we check the fields before hand
	if (bastionResult.status == 200) {
		createHifiUserResponse.wallet.walletStatus = Status.ACTIVE
	} else {
		createHifiUserResponse.wallet.walletStatus = Status.INACTIVE
		createHifiUserResponse.wallet.walletMessage = bastionResult.message
	}


	// create checkbook user
	if (checkbookResult.status == 200) {
		// createHifiUserResponse.ramps.usdAch.onramp.achPull.achPullStatus = Status.ACTIVE
	} else {
		const fieldsToResubmit = createHifiUserResponse.ramps.usdAch.onramp.achPull.achPullActionNeeded.fieldsToResubmit
		createHifiUserResponse.ramps.usdAch.onramp.achPull.achPullStatus = Status.INACTIVE
		createHifiUserResponse.ramps.usdAch.onramp.achPull.achPullActionNeeded.fieldsToResubmit = [...fieldsToResubmit, checkbookResult.invalidFields]
		createHifiUserResponse.ramps.usdAch.onramp.achPull.achPullMessage = checkbookResult.message
	}

	// create bridge customer
	if (bridgeResult.status == 200) {
		createHifiUserResponse.user_kyc.status = Status.PENDING
		createHifiUserResponse.ramps.usdAch.onramp.status = Status.PENDING
		createHifiUserResponse.ramps.usdAch.onramp.achPull.achPullStatus = Status.PENDING
		createHifiUserResponse.ramps.usdAch.offramp.status = Status.PENDING
		createHifiUserResponse.ramps.euroSepa.offramp.status = Status.PENDING
	} else if (bridgeResult.status == 400) {
		createHifiUserResponse.user_kyc.actionNeeded.fieldsToResubmit = bridgeResult.invalidFields
		createHifiUserResponse.user_kyc.message = bridgeResult.message
	} else {
		createHifiUserResponse.user_kyc.message = bridgeResult.message
	}



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
};


exports.getHifiUser = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { user_id } = req.query

	// base response
	let getHifiUserResponse = {}


	const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
		getBastionUser(user_id), // TODO: implement this function in utils and import before using it here
		getBridgeCustomer(user_id), // TODO: implement this function in utils and import before using it here
		getCheckbookUser(user_id) // TODO: implement this function in utils and import before using it here
	])

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
};