const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { fieldsValidation } = require("../util/common/fieldsValidation");
const createAndFundBastionUser = require('../util/bastion/main/createAndFundBastionUser');
const createLog = require('../util/logger/supabaseLogger');
const { createBridgeExternalAccount } = require('../util/bridge/endpoint/createBridgeExternalAccount')
const { createCheckbookBankAccount } = require('../util/checkbook/endpoint/createCheckbookBankAccount')


const Status = {
	ACTIVE: "ACTIVE",
	NOT_CREATED: "NOT_CREATED",
}

// TODO: test this function in postman
exports.createUsdOnrampSourceWithPlaid = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { user_id, plaid_processor_token, bank_name, account_number, routing_number } = req.body;

	// TODO: validate the request body fields to make sure all fields are present and are the valid type

	const checkbookAccountResult = await createCheckbookBankAccount(user_id, plaid_processor_token, bank_name, account_number, routing_number);

	let createUsdOnrampSourceWithPlaidResponse = {
		status: null,
		invalidFields: [],
		message: null,
	}


	if (checkbookAccountResult.status == 200) {
		createUsdOnrampSourceWithPlaidResponse.status = Status.ACTIVE
		createUsdOnrampSourceWithPlaidResponse.id = checkbookAccountResult.id
		createUsdOnrampSourceWithPlaidResponse.message = "Account created successfully"

	} else if (checkbookAccountResult.status == 400) {
		createUsdOnrampSourceWithPlaidResponse.status = Status.NOT_CREATED
		createUsdOnrampSourceWithPlaidResponse.invalidFields = checkbookAccountResult.invalidFields
		createUsdOnrampSourceWithPlaidResponse.message = checkbookAccountResult.message
	} else {
		createUsdOnrampSourceWithPlaidResponse.status = Status.NOT_CREATED
		createUsdOnrampSourceWithPlaidResponse.invalidFields = checkbookAccountResult.invalidFields
		createUsdOnrampSourceWithPlaidResponse.message = checkbookAccountResult.message
	}

	let status

	if (checkbookAccountResult.status === 200) {
		status = 200
	} else if (checkbookAccountResult.status === 500) {
		status = 500;
	} else {
		status = 400;
	}



	return res.status(status).json(createUsdOnrampSourceWithPlaidResponse);

}

exports.createUsdOfframpDestination = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, currency, bankName, accountOwnerName, accountNumber, routingNumber, streetLine1, streetLine2, city, state, postalCode, country, accountOwnerType } = req.body;

	// Define required fields based on account owner type
	let requiredFields = ["userId", "currency", "bankName", "accountOwnerName", "accountOwnerType", "accountNumber", "routingNumber"];
	// if (accountOwnerType === "individual") {
	// 	requiredFields.push("firstName", "lastName");
	// } else if (accountOwnerType === "business") {
	// 	requiredFields.push("businessName");
	// } else {
	// 	return res.status(400).json({ error: "Invalid accountOwnerType" });
	// }
	requiredFields.push("streetLine1", "city", "state", "postalCode", "country");

	// Define accepted fields and their types
	const bridgeRequestStructureTyping = {
		userId: 'string',
		currency: 'string',
		bankName: 'string',
		accountOwnerName: 'string',
		accountNumber: 'string',
		routingNumber: 'string',
		accountOwnerType: 'string',
		streetLine1: 'string',
		streetLine2: 'string',
		city: 'string',
		state: 'string',
		postalCode: 'string',
		country: 'string'
	};

	// Validate fields
	const { missingFields, invalidFields } = fieldsValidation(req.body, requiredFields, bridgeRequestStructureTyping);

	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}

	try {

		const bridgeAccountResult = await createBridgeExternalAccount(
			userId, 'us', currency, bankName, accountOwnerName, accountOwnerType,
			null, null, null,
			streetLine1, streetLine2, city, state, postalCode, country,
			null, null, null, // iban fields not used for USD
			accountNumber, routingNumber
		);


		if (bridgeAccountResult.status !== 200) {
			return res.status(bridgeAccountResult.status).json({
				error: bridgeAccountResult.type,
				message: bridgeAccountResult.message,
				source: bridgeAccountResult.source
			});
		}

		let createUsdOfframpDestinationResponse = {
			status: "ACTIVE",
			invalidFields: [],
			message: "Account created successfully"
		};

		return res.status(200).json(createUsdOfframpDestinationResponse);
	} catch (error) {
		console.error('Error in createUsdOfframpDestination', error);
		return res.status(500).json({ error: 'Internal Server Error', message: error.message });
	}
};



exports.createEuroOfframpDestination = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, currency, bankName, accountOwnerName, ibanAccountNumber, firstName, lastName, businessName, accountOwnerType, businessIdentifierCode, ibanCountryCode } = req.body;

	// Define required fields based on account owner type
	let requiredFields = ["userId", "currency", "bankName", "accountOwnerName", "accountOwnerType", "ibanAccountNumber", "businessIdentifierCode", "ibanCountryCode"];
	if (accountOwnerType === "individual") {
		requiredFields.push("firstName", "lastName");
	} else if (accountOwnerType === "business") {
		requiredFields.push("businessName");
	} else {
		return res.status(400).json({ error: "Invalid accountOwnerType" });
	}

	// Define accepted fields and their types
	const bridgeRequestStructureTyping = {
		userId: 'string',
		currency: 'string',
		bankName: 'string',
		accountOwnerName: 'string',
		accountOwnerType: 'string',
		ibanAccountNumber: 'string',
		country: 'string',
		firstName: 'string',
		lastName: 'string',
		businessName: 'string',
		businessIdentifierCode: 'string',
		ibanCountryCode: 'string'
	};

	// Validate fields
	const { missingFields, invalidFields } = fieldsValidation(req.body, requiredFields, bridgeRequestStructureTyping);

	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}

	try {
		const bridgeAccountResult = await createBridgeExternalAccount(
			userId, 'iban', currency, bankName, accountOwnerName, accountOwnerType,
			firstName, lastName, businessName,
			null, null, null, null, null, null, // address fields not used for IBAN
			ibanAccountNumber, businessIdentifierCode, ibanCountryCode, // iban fields for EUR
			null, null // accountNumber and routingNumber not used for IBAN
		);


		if (bridgeAccountResult.source.key.account_type == "Please contact Bridge to enable SEPA/Euro services") {
			return res.status(bridgeAccountResult.status).json({
				error: bridgeAccountResult.type,
				message: 'Account would normally be successfully created. However, euro offramp creation is currently not available in sandbox.',

			});
		} else if (bridgeAccountResult.status !== 200) {
			return res.status(bridgeAccountResult.status).json({
				error: bridgeAccountResult.type,
				message: bridgeAccountResult.message,
				source: bridgeAccountResult.source
			});
		}

		let createEuroOfframpDestinationResponse = {
			status: "ACTIVE",
			invalidFields: [],
			message: "Account created successfully"
		};

		return res.status(200).json(createEuroOfframpDestinationResponse);
	} catch (error) {
		console.error('Error in createEuroOfframpDestination', error);
		return res.status(500).json({ error: 'Internal Server Error', message: error.message });
	}
};
