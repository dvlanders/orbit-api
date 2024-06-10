const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');

const createAndFundBastionUser = require('../util/bastion/endpoints/createAndFundBastionUser');
const createLog = require('../util/logger/supabaseLogger');
const { createIndividualBridgeCustomer } = require('../util/bridge/endpoint/createIndividualBridgeCustomer')
const {createToSLink} = require("../util/bridge/endpoint/createToSLink")
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

	const { userId } = req.body;

	if (!userId) {
		return res.status(400).json({ error: 'userId is required' });
	}

	let createHifiUserResponse = {
		status: 200,
		walletStatus: "PENDING",
		onrampStatus: "PENDING",
		achPullStatus: "PENDING",
		invalidFields: [],
		message: [],
		additionalDetails: []
	}

	/*
		let invalidFields = []
	*/

	// Create the Bastion user w/ wallet addresses. Fund the polygon wallet.
	try {
		const bastionResult = await createAndFundBastionUser(userId);

		// if the bastionResult returns any error, update the endpoint's response object to reflect
		if (bastionResult.status !== 201) {
			console.log('status not 201')
			createHifiUserResponse.status = bastionResult.status;
			createHifiUserResponse.walletStatus = 'FAILED';
			createHifiUserResponse.message = bastionResult.message;
			createHifiUserResponse.additionalDetails = bastionResult.additionalDetails;
		}




	} catch (error) {
		createLog('createHifiUser', userId, 'Failed to create hifi user', JSON.stringify(error));

		return res.status(500).json(createHifiUserResponse);
	}


	// TODO: William
	// 	Create the Checkbook user
	try {

		// Assuming similar functions exist for these tasks
		// await createCheckbookUser(userId);
		// await createBridgeCustomer(userId);

		// const createBridgeCustomerResult = await createBridgeCustomer(userId);
		// if (createBridgeCustomerResult.status !== 200) {
		// 	createHifiUserResponse.onrampStatus = 'FAILED';
		// 	createHifiUserResponse.status = createBridgeCustomerResult.status;
		// 	createHifiUserResponse.message = createBridgeCustomerResult.message;
		// 	if (createBridgeCustomerResult.invalidFields.length > 0) {
		// 		createHifiUserResponse.invalid_fields = [...createHifiUserResponse.invalid_fields, createBridgeCustomerResult.invalidFields]
		// 	}
		// }

	} catch (error) {
		return res.status(500).json({ error: 'Failed to create user' });
	}
	// TODO: William
	// Create the Bridge customer
	try {

		// Assuming similar functions exist for these tasks
		// await createCheckbookUser(userId);
		// await createBridgeCustomer(userId);

		// const createBridgeCustomerResult = await createBridgeCustomer(userId);
		// if (createBridgeCustomerResult.status !== 200) {
		// 	createHifiUserResponse.onrampStatus = 'FAILED';
		// 	createHifiUserResponse.status = createBridgeCustomerResult.status;
		// 	createHifiUserResponse.message = createBridgeCustomerResult.message;
		// 	if (createBridgeCustomerResult.invalidFields.length > 0) {
		// 		createHifiUserResponse.invalid_fields = [...createHifiUserResponse.invalid_fields, createBridgeCustomerResult.invalidFields]
		// 	}
		// }

	} catch (error) {
		return res.status(500).json({ error: 'Failed to create user' });
	}

	// determine the status code to return to the client
	if (createHifiUserResponse.status === 200 || createHifiUserResponse.status === 201) {
		createHifiUserResponse.message = "User created successfully";
	} else if (createHifiUserResponse.invalidFields.length === 0) {
		console.log('in 400 block')
		createHifiUserResponse.status = 400;
	} else {
		createHifiUserResponse.status = 500;
	}


	return res.status(createHifiUserResponse.status).json(createHifiUserResponse);
};
