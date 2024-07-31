const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { fieldsValidation, isValidISODateFormat } = require("../util/common/fieldsValidation");
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
const { supportedRail, OnRampRail, activateOnRampRailFunctionsCheck } = require('../util/account/activateOnRampRail/utils');
const activateUsAchOnRampRail = require('../util/account/activateOnRampRail/usAch');
const checkUsdOffRampAccount = require('../util/account/createUsdOffRamp/checkBridgeExternalAccount');
const checkEuOffRampAccount = require('../util/account/createEuOffRamp/checkBridgeExternalAccount');
const { accountRailTypes } = require('../util/account/getAccount/utils/rail');
const { fetchRailFunctionsMap, getFetchOnRampVirtualAccountFunctions } = require('../util/account/getAccount/utils/fetchRailFunctionMap');
const { requiredFields } = require('../util/transfer/cryptoToCrypto/utils/createTransfer');
const { verifyUser } = require("../util/helper/verifyUser");
const { stringify } = require('querystring');

const Status = {
	ACTIVE: "ACTIVE",
	NOT_CREATED: "NOT_CREATED",
}

// TODO: test this function in postman
exports.createUsdOnrampSourceWithPlaid = async (req, res) => {

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, profileId } = req.query;

	const { plaidProcessorToken, bankName, accountType } = req.body;
	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "Not authorized" })

	// TODO: validate the request body fields to make sure all fields are present and are the valid type

	const checkbookAccountResult = await createCheckbookBankAccountWithProcessorToken(userId, accountType, plaidProcessorToken, bankName);

	let createUsdOnrampSourceWithPlaidResponse = {
		status: null,
		invalidFields: [],
		message: null,
	}


	if (checkbookAccountResult.status == 200) {
		createUsdOnrampSourceWithPlaidResponse.status = Status.ACTIVE
		createUsdOnrampSourceWithPlaidResponse.id = checkbookAccountResult.id
		createUsdOnrampSourceWithPlaidResponse.message = checkbookAccountResult.message

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

	const { userId, profileId } = req.query;
	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "Not authorized" })

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
	const { missingFields, invalidFields } = fieldsValidation({ ...req.body, userId }, requiredFields, bridgeRequestStructureTyping);

	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}

	try {
		let recordId
		// check if the external account is already exist
		const { externalAccountExist, liquidationAddressExist, externalAccountRecordId } = await checkUsdOffRampAccount({
			userId,
			accountNumber,
			routingNumber
		})
		recordId = externalAccountRecordId

		// already created
		if (externalAccountExist && liquidationAddressExist) {
			return res.status(200).json({
				status: "ACTIVE",
				invalidFields: [],
				message: "Account already exist",
				id: recordId
			})
		}

		// external account is not yet created
		if (!externalAccountExist) {
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

			recordId = v4();

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
				return res.status(500).json({ error: 'Internal Server Error' });
			}
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
	const { userId, profileId } = req.query;
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
		firstName: 'string',
		lastName: 'string',
		businessName: 'string',
		businessIdentifierCode: 'string',
		ibanCountryCode: 'string'
	};

	// Validate fields
	const { missingFields, invalidFields } = fieldsValidation({ ...req.body, userId }, requiredFields, bridgeRequestStructureTyping);

	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}

	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "Not authorized" })


	try {

		let recordId
		// check if the external account is already exist
		const { externalAccountExist, liquidationAddressExist, externalAccountRecordId } = await checkEuOffRampAccount({
			userId,
			ibanAccountNumber,
			businessIdentifierCode
		})
		recordId = externalAccountRecordId

		// account is already existed in the database
		if (externalAccountExist && liquidationAddressExist) {
			return res.status(200).json({
				status: "ACTIVE",
				invalidFields: [],
				message: "Account already created",
				id: recordId
			})
		}

		if (!externalAccountExist) {
			const bridgeAccountResult = await createBridgeExternalAccount(
				userId, 'iban', currency, bankName, accountOwnerName, accountOwnerType,
				firstName, lastName, businessName,
				null, null, null, null, null, null, // address fields not used for IBAN
				ibanAccountNumber, businessIdentifierCode, ibanCountryCode, // iban fields for EUR
				null, null // accountNumber and routingNumber not used for IBAN
			);


			if (bridgeAccountResult.source && bridgeAccountResult.source.key.account_type == "Please contact Bridge to enable SEPA/Euro services") {
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

			recordId = v4();

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
	const { accountId, railType, userId, profileId } = req.query;

	console.log(req.query)
	console.log("accountId", accountId, "railType", railType, "userId", userId, "profileId", profileId)
	if (!userId || !railType || !accountId) return res.status(400).json({ error: 'userId, railType and accountId are required' });

	try {
		if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "Not authorized" })
		if (!(railType in fetchRailFunctionsMap)) {
			return res.status(400).json({ error: 'Invalid railType' });
		}

		const func = fetchRailFunctionsMap[railType]
		const accountInfo = await func(accountId)

		if (!accountInfo) return res.status(404).json({ error: "No account found" })
		accountInfo.railType = railType
		return res.status(200).json(accountInfo);
	} catch (error) {
		console.error(error)
		await createLog("account/getAccount", userId, error.message, error)
		return res.status(500).json({ error: `Unexpected error happened` });
	}
}

exports.getAllAccounts = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// get user id from path parameter
	const fields = req.query
	const { profileId, railType, limit, createdAfter, createdBefore, userId } = fields;
	const requiredFields = ["railType"]
	const acceptedFields = { railType: "string", limit: "string", createdAfter: "string", createdBefore: "string", userId: "string" }

	try {
		if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "Not authorized" })
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.lenght > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })
		const func = fetchRailFunctionsMap[railType]
		const accountInfo = await func(undefined, profileId, userId, limit, createdAfter, createdBefore)
		accountInfo.railType = railType
		return res.status(200).json(accountInfo);
	} catch (error) {
		console.error(error)
		await createLog("account/getAllAccounts", userId, error.message, error)
		return res.status(500).json({ error: `Unexpected error happened` });
	}
}

exports.activateOnRampRail = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, profileId } = req.query
	const fields = req.body
	const { rail, destinationCurrency, destinationChain } = fields
	// fields validation
	const requiredFields = ["rail", "destinationCurrency", "destinationChain"]
	const acceptedFields = { "rail": "string", "destinationCurrency": "string", "destinationChain": "string" }
	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}

	try {
		if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "Not authorized" })
		const activateFunction = activateOnRampRailFunctionsCheck(rail, destinationChain, destinationCurrency)
		if (!activateFunction) return res.status(400).json({ error: `Onramp rail for ${rail}, ${destinationChain}, ${destinationCurrency} is not yet supported` })
		const config = {
			userId,
			destinationCurrency,
			destinationChain
		}
		const result = await activateFunction(config)
		if (result.alreadyExisted) return res.status(200).json({ message: `rail already activated` })
		else if (!result.isAllowedTocreate) return res.status(400).json({ message: `User is not allowed to create the rail` })

		return res.status(200).json({ message: `${rail} create successfully`, account: result.virtualAccountInfo })

	} catch (error) {
		await createLog("account/activateOnRampRail", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.createCircleWireBankAccount = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, accountType, profileId } = req.query;

	// Validate the accountType
	if (!['us', 'nonUsIbanSupported', 'nonUsIbanUnsupported'].includes(accountType)) {
		return res.status(400).json({ error: 'Invalid account type specified' });
	}

	const fields = req.body;

	// Define fields based on account type
	let requiredFields = [];
	let acceptedFields = {};
	switch (accountType) {
		case 'us':
			requiredFields = [
				'accountNumber', 'routingNumber',
				'accountHolderName', 'accountHolderCity', 'accountHolderCountry', 'accountHolderStreetLine1', 'accountHolderPostalCode', 'bankCountry'
			];
			acceptedFields = {
				'accountNumber': 'string', 'routingNumber': 'string',
				'accountHolderName': 'string', 'accountHolderCity': 'string', 'accountHolderCountry': 'string', 'accountHolderStreetLine1': 'string', 'accountHolderStreetLine2': 'string', 'accountHolderStateProvinceRegion': 'string', 'accountHolderPostalCode': 'string',
				'bankName': 'string', 'bankCity': 'string', 'bankCountry': 'string', 'bankStreetLine1': 'string', 'bankStreetLine2': 'string', 'bankStateProvinceRegion': 'string',
			};
			break;
		case 'nonUsIbanSupported':
			requiredFields = [
				'iban',
				'accountHolderName', 'accountHolderCity', 'accountHolderCountry', 'accountHolderStreetLine1', 'accountHolderPostalCodegPostalCode', 'bankCity', 'bankCountry'
			];
			acceptedFields = {
				'iban': 'string',
				'accountHolderName': 'string', 'accountHolderCity': 'string', 'accountHolderCountry': 'string', 'accountHolderStreetLine1': 'string', 'accountHolderStreetLine2': 'string', 'accountHolderStateProvinceRegion': 'string', 'accountHolderPostalCode': 'string', 'bankName': 'string', 'bankCity': 'string', 'bankCountry': 'string', 'bankStreetLine1': 'string', 'bankStreetLine2': 'string', 'bankStateProvinceRegion': 'string'
			};
			break;
		case 'nonUsIbanUnsupported':
			requiredFields = [
				'accountNumber', 'businessIdentifierCode',
				'accountHolderName', 'accountHolderCity', 'accountHolderCountry', 'accountHolderStreetLine1', 'accountHolderPostalCode',
				'bankName', 'bankCity', 'bankCountry'
			];
			acceptedFields = {
				'accountNumber': 'string', 'businessIdentifierCode': 'string',
				'accountHolderName': 'string', 'accountHolderCity': 'string', 'accountHolderCountry': 'string', 'accountHolderStreetLine1': 'string', 'accountHolderStreetLine2': 'string', 'accountHolderStateProvinceRegion': 'string', 'accountHolderPostalCode': 'string', 'bankName': 'string', 'bankCity': 'string', 'bankCountry': 'string', 'bankStreetLine1': 'string', 'bankStreetLine2': 'string', 'bankStateProvinceRegion': 'string',
				'bankName': 'string', 'bankCity': 'string', 'bankCountry': 'string', 'bankStreetLine1': 'string', 'bankStreetLine2': 'string', 'bankStateProvinceRegion': 'string',
			};
			break;
	}

	// Execute fields validation
	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields);
	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}


	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "Not authorized" })

	// construct the requestBody object based on the accountType
	let requestBody = {};

	const idempotencyKey = v4();
	switch (accountType) {
		case 'us':
			requestBody = {
				"idempotencyKey": idempotencyKey,
				"accountNumber": fields.accountNumber,
				"routingNumber": fields.routingNumber,
				"billingDetails": {
					"name": fields.accountHolderName,
					"city": fields.accountHolderCity,
					"country": fields.accountHolderCountry,
					"line1": fields.accountHolderStreetLine1,
					"postalCode": fields.accountHolderPostalCode,
				},
				"bankAddress": {
					"country": fields.bankCountry,
				}
			};
			// Conditionally add optional billing details
			if (fields.accountHolderStreetLine2) {
				requestBody.billingDetails.line2 = fields.accountHolderStreetLine2;
			}
			if (fields.accountHolderStateProvinceRegion) {
				requestBody.billingDetails.district = fields.accountHolderStateProvinceRegion;
			}

			// Conditionally add optional bank address details
			if (fields.bankName) {
				requestBody.bankAddress.bankName = fields.bankName;
			}
			if (fields.bankCity) {
				requestBody.bankAddress.city = fields.bankCity;
			}
			if (fields.bankStreetLine1) {
				requestBody.bankAddress.line1 = fields.bankStreetLine1;
			}
			if (fields.bankStreetLine2) {
				requestBody.bankAddress.line2 = fields.bankStreetLine2;
			}
			if (fields.bankStateProvinceRegion) {
				requestBody.bankAddress.district = fields.bankStateProvinceRegion;
			}
			break;
		case 'nonUsIbanSupported':
			requestBody = {
				"idempotencyKey": idempotencyKey,
				"name": fields.accountHolderName,
				"iban": fields.iban,
				"billingDetails": {
					"name": fields.accountHolderName,
					"city": fields.accountHolderCity,
					"country": fields.accountHolderCountry,
					"line1": fields.accountHolderStreetLine1,
					"postalCode": fields.accountHolderPostalCode,
				},
				"bankAddress": {
					"city": fields.bankCity,
					"country": fields.bankCountry,
				}
			};
			// Conditionally add optional billing details
			if (fields.accountHolderStreetLine2) {
				requestBody.billingDetails.line2 = fields.accountHolderStreetLine2;
			}
			if (fields.accountHolderStateProvinceRegion) {
				requestBody.billingDetails.district = fields.accountHolderStateProvinceRegion;
			}

			// Conditionally add optional bank address details
			if (fields.bankName) {
				requestBody.bankAddress.bankName = fields.bankName;
			}
			if (fields.bankStreetLine1) {
				requestBody.bankAddress.line1 = fields.bankStreetLine1;
			}
			if (fields.bankStreetLine2) {
				requestBody.bankAddress.line2 = fields.bankStreetLine2;
			}
			if (fields.bankStateProvinceRegion) {
				requestBody.bankAddress.district = fields.bankStateProvinceRegion;
			}
			break;
		case 'nonUsIbanUnsupported':
			requestBody = {
				"idempotencyKey": idempotencyKey,
				"accountNumber": fields.accountNumber,
				"routingNumber": fields.businessIdentifierCode,
				"billingDetails": {
					"name": fields.accountHolderName,
					"city": fields.accountHolderCity,
					"country": fields.accountHolderCountry,
					"line1": fields.accountHolderStreetLine1,
					"postalCode": fields.accountHolderPostalCode,
				},
				"bankAddress": {
					"bankName": fields.bankName,
					"city": fields.bankCity,
					"country": fields.bankCountry,
				}
			};
			// Conditionally add optional billing details
			if (fields.accountHolderStreetLine2) {
				requestBody.billingDetails.line2 = fields.accountHolderStreetLine2;
			}
			if (fields.accountHolderStateProvinceRegion) {
				requestBody.billingDetails.district = fields.accountHolderStateProvinceRegion;
			}

			// Conditionally add optional bank address details

			if (fields.bankStreetLine1) {
				requestBody.bankAddress.line1 = fields.bankStreetLine1;
			}
			if (fields.bankStreetLine2) {
				requestBody.bankAddress.line2 = fields.bankStreetLine2;
			}
			if (fields.bankStateProvinceRegion) {
				requestBody.bankAddress.district = fields.bankStateProvinceRegion;
			}
			break;
	}
	try {
		// save the request details to the circle_accounts table
		const { data: circleAccountData, error: circleAccountError } = await supabase
			.from('circle_accounts')
			.insert({
				user_id: userId,
				circle_idempotency_key: idempotencyKey,
				account_type: accountType,
				account_number: requestBody.accountNumber || null,
				routing_number: requestBody.routingNumber || null,
				account_holder_name: requestBody.billingDetails?.name || null,
				account_holder_city: requestBody.billingDetails?.city || null,
				account_holder_country: requestBody.billingDetails?.country || null,
				account_holder_street_line_1: requestBody.billingDetails?.line1 || null,
				account_holder_street_line_2: requestBody.billingDetails?.line2 || null,
				account_holder_state_province_region: requestBody.billingDetails?.district || null,
				account_holder_postal_code: requestBody.billingDetails?.postalCode || null,
				bank_name: requestBody.bankAddress?.bankName || null,
				bank_city: requestBody.bankAddress?.city || null,
				bank_country: requestBody.bankAddress?.country || null,
				bank_street_line_1: requestBody.bankAddress?.line1 || null,
				bank_street_line_2: requestBody.bankAddress?.line2 || null,
				bank_state_province_region: requestBody.bankAddress?.district || null,
				iban: requestBody.iban || null,
				business_identifier_code: requestBody.routingNumber || null,
			}).select()
			;

		if (circleAccountError) {
			return res.status(500).json({ error: 'Internal Server Error' });
		}

		const headers = {
			'Accept': 'application/json',
			'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
			'Content-Type': 'application/json'
		};

		const url = `${process.env.CIRCLE_URL}/businessAccount/banks/wires`;
		const response = await fetch(url, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(requestBody)
		});


		if (response.status === 400 || response.status === 401) {
			const responseData = await response.json();
			await createLog("account/createCircleWireBankAccount", userId, responseData.message, responseData)
			return res.status(400).json({
				error: responseData.message
			});

		}
		// Check if the response is successful
		if (response.status !== 200) {
			const errorData = await response.text();
			throw new Error(`API call failed with status ${response.status}: ${errorData}`);
		}

		const responseData = await response.json();


		// update the circle_account_id, circle_status, circle_description, circle_tracking_ref, circle_fingerprint in the circle_accounts table
		const { data: circleAccountUpdateData, error: circleAccountUpdateError } = await supabase
			.from('circle_accounts')
			.update({
				circle_account_id: responseData.data.id,
				circle_status: responseData.data.status,
				circle_description: responseData.data.description,
				circle_tracking_ref: responseData.data.trackingRef,
				circle_fingerprint: responseData.data.fingerprint
			})
			.match({ id: circleAccountData[0].id })

		if (circleAccountUpdateError) {
			return res.status(500).json({ error: 'Internal Server Error' });
		}

		const responseObject = {};
		if (responseObject.id) responseObject.id = circleAccountData[0].id;
		if (responseData && responseData.data && responseData.data.status) responseObject.status = responseData.data.status;
		if (circleAccountData[0].account_type) responseObject.accountType = circleAccountData[0].account_type;
		if (circleAccountData[0].account_number) responseObject.accountNumber = circleAccountData[0].account_number;
		if (circleAccountData[0].iban) responseObject.iban = circleAccountData[0].iban;
		if (circleAccountData[0].business_identifier_code) responseObject.businessIdentifierCode = circleAccountData[0].business_identifier_code;
		if (circleAccountData[0].account_holder_name) responseObject.accountHolderName = circleAccountData[0].account_holder_name;
		if (circleAccountData[0].account_holder_city) responseObject.accountHolderCity = circleAccountData[0].account_holder_city;
		if (circleAccountData[0].account_holder_country) responseObject.accountHolderCountry = circleAccountData[0].account_holder_country;
		if (circleAccountData[0].account_holder_street_line_1) responseObject.accountHolderStreetLine1 = circleAccountData[0].account_holder_street_line_1;
		if (circleAccountData[0].account_holder_street_line_2) responseObject.accountHolderStreetLine2 = circleAccountData[0].account_holder_street_line_2;
		if (circleAccountData[0].account_holder_state_province_region) responseObject.accountHolderStateProvinceRegion = circleAccountData[0].account_holder_state_province_region;
		if (circleAccountData[0].account_holder_postal_code) responseObject.accountHolderPostalCode = circleAccountData[0].account_holder_postal_code;
		if (circleAccountData[0].bank_name) responseObject.bankName = circleAccountData[0].bank_name;
		if (circleAccountData[0].bank_city) responseObject.bankCity = circleAccountData[0].bank_city;
		if (circleAccountData[0].bank_country) responseObject.bankCountry = circleAccountData[0].bank_country;
		if (circleAccountData[0].bank_street_line_1) responseObject.bankStreetLine1 = circleAccountData[0].bank_street_line_1;
		if (circleAccountData[0].bank_street_line_2) responseObject.bankStreetLine2 = circleAccountData[0].bank_street_line_2;
		if (circleAccountData[0].bank_state_province_region) responseObject.bankStateProvinceRegion = circleAccountData[0].bank_state_province_region;



		// return response object wiht success code
		return res.status(200).json(responseObject);

	} catch (error) {
		await createLog("account/createCircleWireBankAccount", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.getVirtualAccount = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const fileds = req.query
	const { profileId, rail, destinationCurrency, destinationChain, userId, limit, createdBefore, createdAfter } = fileds
	const requiredFields = ["profileId", "rail", "destinationCurrency", "userId", "destinationChain"]
	const acceptedFields = {
		profileId: "string",
		rail: "string",
		destinationCurrency: "string",
		userId: "string",
		destinationChain: "string",
		limit: "string",
		createdBefore: "string",
		createdAfter: "string"
	}

	try {
		if (parseInt(limit) <= 0 || parseInt(limit) > 100) return res.status(400).json({ error: "Limit should be between 1 to 100" })
		const { missingFields, invalidFields } = fieldsValidation(fileds, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: "Fields provided are either invalid or missing", invalidFields, missingFields })
		const fetchFunc = getFetchOnRampVirtualAccountFunctions(rail, destinationCurrency, destinationChain)
		if (!fetchFunc) return res.status(501).json({ message: "Rail is not yet available" })
		const virtualAccount = await fetchFunc(userId, limit, createdBefore, createdAfter)
		if (!virtualAccount) return res.status(404).json({ message: "Rail is not yet activated, please use POST account/activateOnRampRail to activate required rail first" })
		return res.status(200).json(virtualAccount)

	} catch (error) {
		await createLog("account/getVirtualAccount", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.getVirtualAccountMicroDepositInstructions = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const fileds = req.query
	const { profileId, rail, destinationCurrency, destinationChain, userId } = fileds
	const requiredFields = ["profileId", "rail", "destinationCurrency", "userId", "destinationChain"]
	const acceptedFields = {
		profileId: "string",
		rail: "string",
		destinationCurrency: "string",
		userId: "string",
		destinationChain: "string"
	}

	try {
		const { missingFields, invalidFields } = fieldsValidation(fileds, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: "Fields provided are either invalid or missing", invalidFields, missingFields })
		const fetchFunc = getFetchOnRampVirtualAccountFunctions(rail, destinationCurrency, destinationChain)
		if (!fetchFunc) return res.status(400).json({ message: "Rail is not yet available" })
		const despositInformation = await fetchFunc(userId)
		if (!despositInformation) return res.status(404).json({ message: "Rail is not yet activated, please use POST account/activateOnRampRail to activate required rail first" })
		return res.status(200).json(despositInformation)

	} catch (error) {
		await createLog("account/getVirtualAccount", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}

exports.createBlindpayBankAccount = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId } = req.query;


	const fields = req.body;

	const requiredFields = [
		'name', 'currency', 'bankCountry', 'pixKey', "receiverId", "userId"
	];

	const acceptedFields =
	{
		'name': "string", 'currency': "string", 'bankCountry': "string", 'pixKey': "string", "receiverId": "string", "userId": "string"
	};



	// Execute fields validation
	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields);
	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}


	if (!(await verifyUser(fields.userId, profileId))) return res.status(401).json({ error: "Not authorized" })

	const headers = {
		'Accept': 'application/json',
		'Authorization': `Bearer ${process.env.BLINDPAY_API_KEY}`,
		'Content-Type': 'application/json'
	};

	const requestBody = {
		"name": fields.name,
		"currency": fields.currency,
		"bank_country": fields.bankCountry,
		"bank_details": {
			"pix_key": fields.pixKey
		}
	};

	try {
		//get the record on the blindpay_receivers table for a given receiverId
		const { data: blindpayReceiverData, error: blindpayReceiverError } = await supabase
			.from('blindpay_receivers')
			.select()
			.match({ id: fields.receiverId })
			.maybeSingle();

		// if error or no receiver is found
		if (blindpayReceiverError || !blindpayReceiverData) {
			return res.status(500).json({ error: 'Internal Server Error' });
		}

		const url = `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/receivers/${blindpayReceiverData.blindpay_receiver_id}/bank-accounts`;
		const response = await fetch(url, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(requestBody)
		});

		// Check if the response is successful
		if (response.status !== 200) {
			const errorData = await response.text();
			await createLog("account/createBlindpayBankAccount", fields.userId, error.message, error)

			return res.status(400).json({ error: `An error occurred while creating your bank account. Please try again later.` }); // TODO: test for blindpay error types
		}

		const responseData = await response.json();



		// insert the record to the blindpay_accounts table
		const { data: blindpayAccountData, error: blindpayAccountError } = await supabase
			.from('blindpay_accounts')
			.insert({
				name: fields.name,
				currency: fields.currency,
				bank_country: fields.bankCountry,
				pix_key: fields.pixKey,
				blindpay_receiver_id: blindpayReceiverData.blindpay_receiver_id,
				blindpay_account_id: responseData.id,
				user_id: fields.userId,
				blockchain_address: responseData.blockchain_address,
				// brex_vendor_id: responseData.brexVendorId,
			}).select();

		if (blindpayAccountError) {
			console.log('blindpayAccountError', blindpayAccountError)
			await createLog("account/createBlindpayBankAccount", fields.userId, blindpayAccountError.message, blindpayAccountError)
			return res.status(500).json({ error: 'Internal Server Error' });
		}


		// structure a responseObject with the id from the supabase table, name, currency, bank country, pix key, and receiver id
		const responseObject = {
			id: blindpayAccountData[0].id,
			name: fields.name,
			currency: fields.currency,
			bankCountry: fields.bankCountry,
			pixKey: fields.pixKey,
			receiverId: fields.receiverId
		};



		// return response object wiht success code
		return res.status(200).json(responseObject);

	} catch (error) {
		await createLog("account/createBlindpayBankAccount", fields.userId, error.message, error)
		return res.status(500).json({ error: "An error occurred while creating the BR bank account. Please try again later." })
	}

}

exports.createBlindpayReceiver = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId } = req.query;
	const fields = req.body;


	// TODO: Blindpay is in the process of updating their API to include more fields. Update this function when the new API is available
	const requiredFields = [
		'email', 'tax_id', 'type', 'address_line_1', 'city', 'state_province_region', 'country', 'postal_code', 'image_url', 'userId', "firstName", "lastName", "dateOfBirth"
	];

	const acceptedFields = {
		'email': "string", 'tax_id': "string", 'type': "string", 'address_line_1': "string", 'address_line_2': "string",
		'city': "string", 'state_province_region': "string", 'country': "string", 'postal_code': "string", 'image_url': "string",
		'userId': "string", "firstName": "string", "lastName": "string", "dateOfBirth": "string"
	};

	// Execute fields validation
	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields);
	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}

	if (fields.dateOfBirth && !isValidISODateFormat(fields.dateOfBirth)) return res.status(400).json({ error: "Invalid date of birth" });

	if (!(await verifyUser(fields.userId, profileId))) return res.status(401).json({ error: "Not authorized" })

	const headers = {
		'Accept': 'application/json',
		'Authorization': `Bearer ${process.env.BLINDPAY_API_KEY}`,
		'Content-Type': 'application/json'
	};


	try {
		// Create Blindpay Receiver
		const receiverRequestBody = {
			email: fields.email,
			tax_id: fields.tax_id,
			type: fields.type,
			country: fields.country,
			individual: {
				first_name: fields.firstName,
				last_name: fields.lastName,
				date_of_birth: new Date(fields.dateOfBirth).toISOString()
			},
			// address_line_1: fields.address_line_1,
			// address_line_2: fields.address_line_2,
			// city: fields.city,
			// state_province_region: fields.state_province_region,
			// postal_code: fields.postal_code,
			// image_url: fields.image_url
		};


		const receiverResponse = await fetch(`${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/receivers`, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(receiverRequestBody)
		});

		if (receiverResponse.status !== 200) {
			const errorData = await receiverResponse.json();
			await createLog("account/createBlindpayReceiver", fields.userId, errorData, receiverResponse);
			return res.status(400).json({ error: `An error occurred while creating the receiver. Please try again later.`, message: errorData.message, path: errorData.errors });
		}

		const receiverData = await receiverResponse.json();


		// Insert receiver data into blindpay_receivers table
		const { data: receiverRecord, error: receiverError } = await supabase
			.from('blindpay_receivers')
			.insert({
				email: fields.email,
				type: fields.type,
				country: fields.country,
				blindpay_receiver_id: receiverData.id,
				user_id: fields.userId
			}).select().single();

		if (receiverError) {
			console.log('receiverError', receiverError)
			await createLog("account/createBlindpayReceiver", fields.userId, receiverError.message, receiverError);
			return res.status(500).json({ error: 'Internal Server Error' });
		}


		const responseObject = {
			id: receiverRecord.id,
			email: fields.email,
			type: fields.type,
			country: fields.country,

		};

		return res.status(200).json(responseObject);

	} catch (error) {
		await createLog("account/createBlindpayReceiver", fields.userId, error.message, error);
		return res.status(500).json({ error: "An error occurred while creating the receiver. Please try again later." });
	}
}
