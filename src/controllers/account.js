const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { fieldsValidation } = require("../util/common/fieldsValidation");
const createAndFundBastionUser = require('../util/bastion/fundMaticPolygon');
const createLog = require('../util/logger/supabaseLogger');
const { createBridgeExternalAccount } = require('../util/bridge/endpoint/createBridgeExternalAccount')
const { createBridgeLiquidationAddress } = require('../util/bridge/endpoint/createBridgeLiquidationAddress')
const { createCheckbookBankAccountWithProcessorToken } = require('../util/checkbook/endpoint/createCheckbookBankAccount')
const { getBridgeExternalAccount } = require('../util/bridge/endpoint/getBridgeExternalAccount');
const { supabaseCall } = require('../util/supabaseWithRetry');
const { v4 } = require('uuid');
const { BridgeCustomerStatus } = require('../util/bridge/utils');
const { createDefaultBridgeVirtualAccount, createBridgeVirtualAccountError } = require('../util/bridge/endpoint/createBridgeVirtualAccount');
const { supportedRail, OnRampRail } = require('../util/account/activateOnRampRail/utils');
const activateUsAchOnRampRail = require('../util/account/activateOnRampRail/usAch');

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

	const checkbookAccountResult = await createCheckbookBankAccountWithProcessorToken(user_id, plaid_processor_token, bank_name, account_number, routing_number);

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

	const { userId } = req.query;

	const { currency, bankName, accountOwnerName, accountNumber, routingNumber, streetLine1, streetLine2, city, state, postalCode, country, accountOwnerType } = req.body;



	// Define required fields based on account owner type
	let requiredFields = ["userId", "currency", "bankName", "accountOwnerName", "accountOwnerType", "accountNumber", "routingNumber"];
	// if (accountOwnerType === "individual") {
	// 	requiredFields.push("firstName", "lastName");
	// } else if (accountOwnerType === "business") {
	// 	requiredFields.push("businessName");C
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
	const { missingFields, invalidFields } = fieldsValidation({...req.body, userId}, requiredFields, bridgeRequestStructureTyping);

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
				source: bridgeAccountResult.source,

			});
		}

		console.log('raw result', bridgeAccountResult.rawResponse)

		const recordId = v4();

		const { error: bridgeAccountInserterror } = await supabase
			.from('bridge_external_accounts')
			.insert({
				id: recordId,
				user_id: userId,
				currency: currency,
				bank_name: bankName,
				account_owner_name: accountOwnerName,
				account_owner_type: accountOwnerType,
				account_type: 'us',
				beneficiary_street_line_1: streetLine1,
				beneficiary_street_line_2: streetLine2,
				beneficiary_city: city,
				beneficiary_state: state,
				beneficiary_postal_code: postalCode,
				beneficiary_country: country,
				account_number: accountNumber,
				routing_number: routingNumber,
				bridge_response: bridgeAccountResult.rawResponse,
				bridge_external_account_id: bridgeAccountResult.rawResponse.id,
			})

		if (bridgeAccountInserterror) {
			return res.status(500).json({ error: 'Internal Server Error', message: bridgeAccountInserterror });
		}

		// now create the liquidation address for the external account
		const liquidationAddressResult = await createBridgeLiquidationAddress(userId, recordId, 'ach', 'usd');

		if (liquidationAddressResult.status !== 200) {
			return res.status(liquidationAddressResult.status).json({
				error: liquidationAddressResult.type,
				message: liquidationAddressResult.message,
				source: liquidationAddressResult.source
			});
		}

		// create a record in the bridge_liquidation_addresses table

		let createUsdOfframpDestinationResponse = {
			status: "ACTIVE",
			invalidFields: [],
			message: "Account created successfully",
			id: recordId
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
	const { userId } = req.query;

	const { currency, bankName, accountOwnerName, ibanAccountNumber, firstName, lastName, businessName, accountOwnerType, businessIdentifierCode, ibanCountryCode } = req.body;

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
	const { missingFields, invalidFields } = fieldsValidation({...req.body, userId}, requiredFields, bridgeRequestStructureTyping);

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

		console.log('raw result', bridgeAccountResult.rawResponse)

		const recordId = v4();

		const { error: bridgeAccountInserterror } = await supabase
			.from('bridge_external_accounts')
			.insert({
				id: recordId,
				user_id: userId,
				currency: currency,
				bank_name: bankName,
				account_owner_name: accountOwnerName,
				account_owner_type: accountOwnerType,
				account_type: 'iban',
				beneficiary_first_name: firstName,
				beneficiary_last_name: lastName,
				beneficiary_business_name: businessName,
				iban: ibanAccountNumber,
				business_identifier_code: businessIdentifierCode,
				bank_country: ibanCountryCode,
				bridge_response: bridgeAccountResult.rawResponse,
				bridge_external_account_id: bridgeAccountResult.rawResponse.id,
			})

		if (bridgeAccountInserterror) {
			return res.status(500).json({ error: 'Internal Server Error', message: bridgeAccountInserterror });
		}

		// now create the liquidation address for the external account
		const liquidationAddressResult = await createBridgeLiquidationAddress(userId, recordId, 'sepa', 'eur');

		if (liquidationAddressResult.status !== 200) {
			return res.status(liquidationAddressResult.status).json({
				error: liquidationAddressResult.type,
				message: liquidationAddressResult.message,
				source: liquidationAddressResult.source
			});
		}

		let createEuroOfframpDestinationResponse = {
			status: "ACTIVE",
			invalidFields: [],
			message: "Account created successfully",
			id: recordId
		};

		return res.status(200).json(createEuroOfframpDestinationResponse);
	} catch (error) {
		console.error('Error in createEuroOfframpDestination', error);
		return res.status(500).json({ error: 'Internal Server Error' });
	}
};


exports.getAccount = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// get user id from path parameter
	const { userId, accountId, accountType } = req.query;


	if (!['usOnramp', 'usOfframp', 'euOfframp'].includes(accountType)) {
		return res.status(400).json({ error: 'Invalid accountType' });
	}




	// if the account type is usOfframp or euOfframp, get the account from the bridge_external_accounts table
	if (accountType === 'usOfframp' || accountType === 'euOfframp') {
		try {



			const { data: bridgeExternalAccountData, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
				.from('bridge_external_accounts')
				.select('id, created_at, currency, bank_name, account_owner_name, account_owner_type, account_type, beneficiary_street_line_1, beneficiary_street_line_2, beneficiary_city, beneficiary_state, beneficiary_postal_code, beneficiary_country, iban, business_identifier_code, bank_country, account_number, routing_number')
				.eq('id', accountId)
				.maybeSingle()
			)


			if (bridgeExternalAccountError) {
				return res.status(400).json({ error: 'Could not find this account in the database. Please make sure that the account has been created for this user.' });
			}


			return res.status(200).json({
				data: bridgeExternalAccountData

			});
		} catch (error) {
			console.error('Error in getAccount', error);

		}
	}

	// if the account type is usOnramp, get the account from the checkbook_bank_accounts table
	if (accountType === 'usOnramp') {
		try {
			// TODO: implement getCheckbookBankAccount function
			// const checkbookBankAccountResult = await getCheckbookBankAccount(userId);


			console.log('TODO: getCheckbookBankAccount function not implemented yet.');
			return res.status(200).json(checkbookBankAccountResult);
		} catch (error) {
			console.error('Error in getAccount', error);

		}
	}

	// return error if the account id with that account type is not recognized
	return res.status(400).json({ error: `An account with accountId == ${accountId} of type == ${accountType} could not be found. Please make sure that the this account has indeed been created for userId == ${userId}` });
}

exports.activateOnRampRail = async(req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const {userId} = req.query
	const {rail} = req.body
	let result
	if (!rail) return res.status("400").json({error: "rail is required"})
	if (!supportedRail.has(rail)) return res.status("400").json({error: "Unsupported rail"})
	try{
		if (rail == OnRampRail.US_ACH){
			result = await activateUsAchOnRampRail(userId)
		}else{
			return res.status(501).json({message: `${rail} is not yet implemented`})
		}

		if (result.alreadyExisted) return res.status(200).json({message: `rail already activated`})
		else if (!result.isAllowedTocreate) return res.status(400).json({message: `User is not allowed to create the rail`})

		return res.status(200).json({message: `${rail} create successfully`})

	}catch (error){
		createLog("account/activateOnRampRail", userId, error.message, error.rawResponse)
		return res.status(500).json({error: "Unexpected error happened"})
	}

}