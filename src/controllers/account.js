const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { fieldsValidation, isValidISODateFormat, isUUID } = require("../util/common/fieldsValidation");
const createLog = require('../util/logger/supabaseLogger');
const { createBridgeExternalAccount } = require('../util/bridge/endpoint/createBridgeExternalAccount')
const { createBridgeLiquidationAddress } = require('../util/bridge/endpoint/createBridgeLiquidationAddress')
const { createCheckbookBankAccountWithProcessorToken } = require('../util/checkbook/endpoint/createCheckbookBankAccount')
const { v4 } = require('uuid');
const { supportedRail, OnRampRail, activateOnRampRailFunctionsCheck } = require('../util/account/activateOnRampRail/utils');
const checkUsdOffRampAccount = require('../util/account/createUsdOffRamp/checkBridgeExternalAccount');
const checkEuOffRampAccount = require('../util/account/createEuOffRamp/checkBridgeExternalAccount');
const { accountRailTypes } = require('../util/account/getAccount/utils/rail');
const { getFetchOnRampVirtualAccountFunctions, getAccountsInfo } = require('../util/account/getAccount/utils/fetchRailFunctionMap');
const { fetchAccountProviders, insertAccountProviders, fetchAccountProvidersWithRail } = require('../util/account/accountProviders/accountProvidersService');
const { requiredFields } = require('../util/transfer/cryptoToCrypto/utils/createTransfer');
const { verifyUser } = require("../util/helper/verifyUser");
const { stringify } = require('querystring');
const { virtualAccountPaymentRailToChain } = require('../util/bridge/utils');
const { isInRange, isValidDate, inStringEnum, isHIFISupportedChain, isValidEmail, isValidUrl } = require('../util/common/filedValidationCheckFunctions');
const createReapOfframpAccount = require('../util/account/createReapOfframp/createReapOfframpAccount');
const { networkCheck } = require('../util/reap/utils/networkCheck');
const { basicReapAccountInfoCheck } = require('../util/reap/utils/basicAccountInfoCheck');
const { create } = require('lodash');
const { uploadReceiverKYCInfo } = require('../util/blindpay/uploadReceiverInfo');
const { updateReceiverKYCInfo } = require('../util/blindpay/updateReceiverInfo');
const { uploadBankAccountInfo } = require('../util/blindpay/uploadBankAccountInfo');
const { ReceiverInfoUploadError, BankAccountInfoUploadError, CreateBankAccountError, ReceiverInfoGetError } = require('../util/blindpay/errors');
const { createReceiver } = require('../util/blindpay/endpoint/createReceiver');
const { updateReceiver } = require('../util/blindpay/endpoint/updateReceiver');
const { createBankAccount } = require('../util/blindpay/endpoint/createBankAccount');
const { getReceiverInfo } = require('../util/blindpay/getReceiverInfo');

const Status = {
	ACTIVE: "ACTIVE",
	NOT_CREATED: "NOT_CREATED",
}

exports.createUsdOnrampSourceWithPlaid = async (req, res) => {

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, profileId } = req.query;

	const { plaidProcessorToken, bankName, accountType, createVirtualAccount } = req.body;
	const requiredFields = ["plaidProcessorToken", "bankName", "accountType", "createVirtualAccount"];
	const acceptedFields = { plaidProcessorToken: "string", bankName: "string", accountType: "string", createVirtualAccount: "boolean" };
	const { missingFields, invalidFields } = fieldsValidation(req.body, requiredFields, acceptedFields)
	if (missingFields.length > 0 || invalidFields.length > 0) {
		return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
	}
	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "userId not found" })
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

		// if the user wants to also create a virtual account
		if (createVirtualAccount) {
			const rail = OnRampRail.US_ACH_WIRE
			const destinationChain = virtualAccountPaymentRailToChain.polygon
			const destinationCurrency = "usdc"

			const activateFunction = activateOnRampRailFunctionsCheck(rail, destinationChain, destinationCurrency)
			const config = {
				userId,
				destinationCurrency,
				destinationChain
			}
			const result = await activateFunction(config)
			if (result.alreadyExisted) createUsdOnrampSourceWithPlaidResponse.message += " (Virtual account already existed)"
			else if (!result.isAllowedTocreate) createUsdOnrampSourceWithPlaidResponse.message += " (User is not allowed to create a virtual account)"
			else createUsdOnrampSourceWithPlaidResponse.message += " (Virtual account created successfully)"

		}

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
	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "userId not found" })

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
		userId: (value) => isUUID(value),
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

	if (missingFields.length > 0 || invalidFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields, invalidFields });
	}
	try {
		let recordId;
		const { externalAccountExist, liquidationAddressExist, externalAccountRecordId } = await checkUsdOffRampAccount({
			userId,
			accountNumber,
			routingNumber
		}).catch(error => {
			console.error("Error checking USD off-ramp account", error);
			throw new Error("Error checking USD off-ramp account: " + error.message);
		});

		recordId = externalAccountRecordId;

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
					source: bridgeAccountResult.source
				});
			}

			const newBridgeExternalAccountRecordId = v4();
			// we handle the insert after the bridge account creation because we want the user to be able to try to create the account again if the account creation fails
			const { error: bridgeAccountInserterror } = await supabase
				.from('bridge_external_accounts')
				.insert({
					id: newBridgeExternalAccountRecordId,
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


			const accountProviderRecord = await insertAccountProviders(newBridgeExternalAccountRecordId, "usd", "offramp", "ach", "BRIDGE", userId);
			return res.status(200).json({
				status: "ACTIVE",
				invalidFields: [],
				message: "Account created successfully",
				id: accountProviderRecord.id
			});
		} else {
			const { data: providerAccountRecordData, error: providerAccountRecordError } = await supabase
				.from('account_providers')
				.select('id, payment_rail')
				.eq('account_id', recordId);

			if (providerAccountRecordError) {
				console.log(providerAccountRecordError);
				throw new Error("Failed to retrieve provider account records: " + providerAccountRecordError.message);
			}

			let achRecord = providerAccountRecordData.find(record => record.payment_rail === 'ach');

			if (achRecord) {
				return res.status(200).json({
					status: "ACTIVE",
					invalidFields: [],
					message: "Account already exists",
					id: achRecord.id
				});
			}

			const accountProviderRecord = await insertAccountProviders(recordId, currency, "offramp", "ach", "BRIDGE", userId);
			return res.status(200).json({
				status: "ACTIVE",
				invalidFields: [],
				message: "Account created successfully",
				id: accountProviderRecord.id
			});
		}

	} catch (error) {
		createLog("account/createUsdOfframpDestination", userId, error.message, error);
		console.error('Error in createUsdOfframpDestination', error);
		return res.status(500).json({ error: 'Internal Server Error', message: error.message || "An unexpected error occurred" });
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
		userId: (value) => isUUID(value),
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

	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "userId not found" })


	try {
		let recordId;
		const { externalAccountExist, liquidationAddressExist, externalAccountRecordId } = await checkEuOffRampAccount({
			userId,
			ibanAccountNumber,
			businessIdentifierCode
		}).catch(error => {
			console.error("Error checking EU off-ramp account", error);
			throw new Error("Error checking EU off-ramp account: " + error.message);
		});

		recordId = externalAccountRecordId;

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


			const newBridgeExternalAccountRecordId = v4();
			// we handle the insert after the bridge account creation because we want the user to be able to try to create the account again if the account creation fails
			const { error: bridgeAccountInserterror } = await supabase
				.from('bridge_external_accounts')
				.insert({
					id: newBridgeExternalAccountRecordId,
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

				})

			if (bridgeAccountInserterror) {
				return res.status(500).json({ error: 'Internal Server Error', message: bridgeAccountInserterror });
			}


			const accountProviderRecord = await insertAccountProviders(newBridgeExternalAccountRecordId, "eur", "offramp", "sepa", "BRIDGE", userId);
			return res.status(200).json({
				status: "ACTIVE",
				invalidFields: [],
				message: "Account created successfully",
				id: accountProviderRecord.id
			});
		} else {
			const { data: providerAccountRecordData, error: providerAccountRecordError } = await supabase
				.from('account_providers')
				.select('id, payment_rail')
				.eq('account_id', recordId);

			if (providerAccountRecordError) {
				console.log(providerAccountRecordError);
				throw new Error("Failed to retrieve provider account records: " + providerAccountRecordError.message);
			}

			let sepaRecord = providerAccountRecordData.find(record => record.payment_rail === 'sepa');

			if (sepaRecord) {
				return res.status(200).json({
					status: "ACTIVE",
					invalidFields: [],
					message: "Account already exists",
					id: sepaRecord.id
				});
			}

			const accountProviderRecord = await insertAccountProviders(recordId, currency, "offramp", "sepa", "BRIDGE", userId);
			return res.status(200).json({
				status: "ACTIVE",
				invalidFields: [],
				message: "Account created successfully",
				id: accountProviderRecord.id
			});
		}

	} catch (error) {
		createLog("account/createEuroOfframpDestination", userId, error.message, error);
		console.error('Error in createEuroOfframpDestination', error);
		return res.status(500).json({ error: 'Internal Server Error', message: error.message || "An unexpected error occurred" });
	}

};

exports.getAccount = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// get user id from path parameter
	const { accountId, profileId } = req.query;

	const requiredFields = ["accountId"]
	const acceptedFields = { accountId: (value) => isUUID(value) }

	try {
		const { missingFields, invalidFields } = fieldsValidation(req.query, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		if (!isUUID(accountId)) return res.status(400).json({ error: 'Invalid accountId' });

		const account = await fetchAccountProviders(accountId, profileId); // returns an account object
		if (!account) return res.status(404).json({ error: "No account found" })
		let accountInfo = await getAccountsInfo([account]);

		if (accountInfo.count === 0) return res.status(404).json({ error: "No account found" })
		if (accountInfo.count > 1) await createLog("account/getAccount", null, "Account Id exists at more than one place", null, profileId)
		accountInfo = accountInfo.banks[0]

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
	const { profileId, currency, railType, paymentRail, limit, createdAfter, createdBefore, userId } = fields;

	const requiredFields = []
	if (!currency && !railType) {
		return res.status(400).json({ error: 'Please provide at least one of the following: currency, railType.' });
	}
	const acceptedFields = {
		currency: (value) => inStringEnum(value, ["usd", "eur", "brl", "hkd"]),
		railType: (value) => inStringEnum(value, ["onramp", "offramp"]),
		paymentRail: (value) => inStringEnum(value, ["ach", "sepa", "wire", "pix", "chats", "fps"]),
		limit: (value) => isInRange(value, 1, 100),
		createdAfter: (value) => isValidDate(value, "ISO"),
		createdBefore: (value) => isValidDate(value, "ISO"),
		userId: (value) => isUUID(value)
	}

	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })

		if (userId && !(await verifyUser(userId, profileId))) return res.status(401).json({ error: "userId not found" })

		const accounts = await fetchAccountProvidersWithRail(currency, railType, paymentRail, userId, profileId, limit, createdAfter, createdBefore); // returns an accounts array
		const accountsInfo = await getAccountsInfo(accounts);

		return res.status(200).json(accountsInfo);
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
	let { rail, destinationCurrency, destinationChain } = fields
	// fields validation
	const requiredFields = ["rail"]
	const acceptedFields = {
		"rail": (value) => inStringEnum(value, ["US_ACH_WIRE"]),
		"destinationCurrency": (value) => inStringEnum(value, ["usdc", "usdt"]),
		"destinationChain": (value) => isHIFISupportedChain(value)
	}
	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
	if (missingFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields });
	}

	if (invalidFields.length > 0) {
		return res.status(400).json({ error: 'Invalid fields', invalidFields });
	}

	if (!(destinationCurrency && destinationChain) && !(!destinationCurrency && !destinationChain))
		return res.status(400).json({ error: 'Please provide both destinationCurrency and destinationChain or neither' });

	if (!destinationCurrency && !destinationChain) {
		destinationCurrency = "usdc"
		destinationChain = virtualAccountPaymentRailToChain.polygon
	}

	try {
		if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "userId not found" })
		const activateFunction = activateOnRampRailFunctionsCheck(rail, destinationChain, destinationCurrency)
		if (!activateFunction) return res.status(400).json({ error: `Onramp rail for ${rail}, ${destinationChain}, ${destinationCurrency} is not yet supported` })
		const config = {
			userId,
			destinationCurrency,
			destinationChain
		}
		const result = await activateFunction(config)
		if (result.alreadyExisted) {
			const resObj = { message: `Virtual account for the rail already existed` };
			if (result.virtualAccountInfo) resObj.account = result.virtualAccountInfo
			return res.status(200).json(resObj)
		}
		else if (!result.isAllowedTocreate) return res.status(400).json({
			message: `User is not allowed to create a virtual account for the rail`,
			hint: `Make sure that this user has passed KYC / KYB successfully before calling this endpoint`
		})

		return res.status(200).json({ message: `Virtual account for ${rail} created successfully`, account: result.virtualAccountInfo })

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


	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "userId not found" })

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

		accountProviderRecord = await insertAccountProviders(circleAccountData[0].id, "usd", "offramp", "wire", "CIRCLE", userId)

		const responseObject = {};
		if (circleAccountData[0].id) responseObject.id = accountProviderRecord.id;
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

	const fields = req.query
	const { profileId, rail, destinationCurrency, destinationChain, userId, limit, createdBefore, createdAfter } = fields
	const requiredFields = ["profileId", "rail", "destinationCurrency", "userId", "destinationChain"]
	const acceptedFields = {
		profileId: "string",
		rail: (value) => inStringEnum(value, ["US_ACH_WIRE"]),
		destinationCurrency: (value) => inStringEnum(value, ["usdc", "usdt"]),
		userId: (value) => isUUID(value),
		destinationChain: (value) => isHIFISupportedChain(value),
		limit: (value) => isInRange(value, 1, 100),
		createdBefore: (value) => isValidISODateFormat(value),
		createdAfter: (value) => isValidISODateFormat(value)
	}

	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
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

exports.createBlindpayBankAccount = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId, userId, receiverId } = req.query;
	if (!userId || !receiverId) return res.status(400).json({ error: "userId or receiverId is missing" })

	const fields = req.body;
	fields.user_id = userId;
	fields.receiver_id = receiverId;
	if (!isUUID(receiverId)) return res.status(400).json({ error: "Invalid receiver_id" })
	if (!(await verifyUser(fields.user_id, profileId))) return res.status(401).json({ error: "userId not found" })

	let bankAccountExist, bankAccountRecord
	// upload information and create new user
	try {
		({ bankAccountExist, bankAccountRecord } = await uploadBankAccountInfo(fields))
	} catch (error) {
		if (error instanceof BankAccountInfoUploadError) {
			return res.status(error.status).json(error.rawResponse)
		}
		await createLog("account/createBlindpayBankAccount", fields.user_id, `Failed to Upload Bank Account Info For user: ${fields.user_id}`, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
	}

	if (bankAccountExist) {
		const responseObject = {
			status: "ACTIVE",
			invalidFields: [],
			message: "Account already exists",
			id: bankAccountRecord.global_account_id
		};
		return res.status(200).json(responseObject);
	}

	try {
		const response = await createBankAccount(bankAccountRecord)
		const account = await insertAccountProviders(bankAccountRecord.id, "brl", "offramp", bankAccountRecord.type, "BLINDPAY", bankAccountRecord.user_id)
		// insert the record to the blindpay_accounts table
		const { error: bankAccountUpdateError } = await supabase
			.from('blindpay_bank_accounts')
			.update({
				blindpay_response: response,
				blindpay_account_id: response.id,
				blockchain_address: response.blockchain_address,
				global_account_id: account.id,
			})
			.eq('id', bankAccountRecord.id)

		if (bankAccountUpdateError) {
			await createLog("account/createBlindpayBankAccount", fields.user_id, bankAccountUpdateError.message, bankAccountUpdateError)
			return res.status(500).json({ error: 'Internal Server Error' });
		}

		const responseObject = {
			status: "ACTIVE",
			invalidFields: [],
			message: "Account created successfully",
			id: account.id
		};

		// return response object wiht success code
		return res.status(200).json(responseObject);

	} catch (error) {
		await createLog("account/createBlindpayBankAccount", fields.userId, error.message, error)
		if (error instanceof CreateBankAccountError) {
			return res.status(error.status).json(error.rawResponse)
		}
		return res.status(500).json({ error: "An error occurred while creating the BR bank account. Please try again later." })
	}

}

exports.createBlindpayReceiver = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId, userId } = req.query;
	const fields = req.body;
	fields.user_id = userId;

	if (!(await verifyUser(fields.user_id, profileId))) return res.status(401).json({ error: "userId not found" })

	let receiverRecord
	// upload information
	try {
		receiverRecord = await uploadReceiverKYCInfo(fields)
	} catch (error) {
		if (error instanceof ReceiverInfoUploadError) {
			return res.status(error.status).json(error.rawResponse)
		}
		await createLog("account/createBlindpayReceiver", fields.user_id, `Failed to Upload Receiver Info For user: ${fields.user_id}`, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
	}

	// console.log("receiverRecord: \n", receiverRecord)
	try {
		const response = await createReceiver(receiverRecord)

		// Insert receiver data into blindpay_receivers table
		const { error: receiverUpdateError } = await supabase
			.from('blindpay_receivers_kyc')
			.update({
				blindpay_receiver_id: response.id,
				blindpay_response: response,
				kyc_status: "verifying"
			}).eq('id', receiverRecord.id);

		if (receiverUpdateError) {
			await createLog("account/createBlindpayReceiver", fields.user_id, receiverUpdateError.message, receiverUpdateError);
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}

		const responseObject = {
			id: receiverRecord.id,
			type: fields.type,
			kyc_status: "verifying",
			user_id: fields.user_id
		};

		return res.status(200).json(responseObject);

	} catch (error) {
		await createLog("account/createBlindpayReceiver", fields.userId, error.message, error);
		return res.status(500).json({ error: "An error occurred while creating the receiver. Please try again later." });
	}
}

exports.createAPACOfframpDestination = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId, profileId } = req.query;
	if (!(await verifyUser(userId, profileId))) return res.status(401).json({ error: "userId not found" })
	const fields = req.body
	const {
		recipientType,
		companyName,
		firstName,
		lastName,
		middleName,
		legalFullName,
		accountType,
		accountIdentifierStandard,
		accountIdentifierValue,
		currency,
		bankName,
		bankCountry,
		bankCode,
		addressType,
		street,
		state,
		country,
		city,
		postalCode,
		network
	} = fields

	const requiredFields = [
		"recipientType",
		"accountType",
		"accountIdentifierStandard",
		"accountIdentifierValue",
		"currency",
		"bankName",
		"bankCountry",
		"bankCode",
		"addressType",
		"street",
		"state",
		"country",
		"city",
		"postalCode",
		"network"
	]

	const acceptedFields = {
		recipientType: "string",
		companyName: "string",
		firstName: "string",
		lastName: "string",
		middleName: "string",
		legalFullName: "string",
		accountType: "string",
		accountIdentifierStandard: "string",
		accountIdentifierValue: "string",
		currency: "string",
		bankName: "string",
		bankCountry: "string",
		bankCode: "string",
		addressType: "string",
		street: "string",
		state: "string",
		country: "string",
		city: "string",
		postalCode: "string",
		network: "string"
	};

	try {

		const { invalidFields, missingFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0) {
			return res.status(400).json({ error: 'Missing required fields', missingFields });
		}

		if (invalidFields.length > 0) {
			return res.status(400).json({ error: 'Invalid fields', invalidFields });
		}
		if (recipientType != "company") return res.status(400).json({ error: 'Only company is allowed to create HK offramp for now' });
		if (recipientType == "company" && !companyName) return res.status(400).json({ error: 'companyName is missing' });
		if (recipientType == "individual" && (!firstName || !lastName)) return res.status(400).json({ error: 'firstName or lastName is missing' });
		if (!networkCheck(network, currency)) return res.status(400).json({ error: "Currency and network not matched" })
		if (!basicReapAccountInfoCheck(fields)) return res.status(400).json({ error: "Invalid banking information" })
		const account = await createReapOfframpAccount({ ...fields, userId })
		let accountInfo = {
			status: "ACTIVE",
			invalidFields: [],
			message: "Account created successfully",
			id: account.accountId
		};
		return res.status(200).json(accountInfo)

	} catch (error) {
		await createLog("account/createHKOfframpDestination", userId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}



}

exports.createInternationalWireOfframpDestination = async (req, res) => {
	const { userId, profileId } = req.query;
	const {
		accountType, currency, bankName, accountOwnerName, ibanAccountNumber, firstName, lastName,
		businessName, accountOwnerType, businessIdentifierCode, ibanCountryCode,
		accountNumber, routingNumber, streetLine1, streetLine2, city, state, postalCode, country
	} = req.body;


	const fields = req.body;

	if (!(await verifyUser(userId, profileId))) {
		return res.status(401).json({ error: "userId not found" });
	}

	// verify required fields

	const requiredFields = [
		'accountType', 'currency', 'bankName', 'accountOwnerName', 'accountOwnerType', 'streetLine1', 'city', 'state', 'postalCode', "country"
	];

	const acceptedFields = {
		'currency': "string", 'bankName': "string", 'accountOwnerName': "string", 'ibanAccountNumber': "string", 'firstName': "string",
		'lastName': "string", 'businessName': "string", 'accountOwnerType': (value) => inStringEnum(value, ["individual", "business"]), 'businessIdentifierCode': "string", 'ibanCountryCode': "string",
		'accountNumber': "string", "routingNumber": "string", "streetLine1": "string", "streetLine2": "string", "city": "string", "state": "string", "postalCode": "string", "country": "string", "userId": (value) => isUUID(value),
		'accountType': (value) => inStringEnum(value, ["us", "iban"])
	};

	// Execute fields validation
	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields);
	if (missingFields.length > 0 || invalidFields.length > 0) {
		return res.status(400).json({ error: 'Missing required fields', missingFields, invalidFields });
	}

	// if the accountOwnerType is business, make sure that the businessName is provided. if individual, then make sure that the firstName and lastName are provided
	if (accountOwnerType === 'business' && !businessName) {
		return res.status(400).json({ error: 'The businessName field is required when the accountOwnerType is business' });
	}

	if (accountOwnerType === 'individual' && (!firstName || !lastName)) {
		return res.status(400).json({ error: 'The firstName and lastName fields are required when the accountOwnerType is individual' });
	}


	try {
		const { externalAccountExist, liquidationAddressExist, externalAccountRecordId } = accountType === 'us'
			? await checkUsdOffRampAccount({ userId, accountNumber, routingNumber })
			: await checkEuOffRampAccount({ userId, ibanAccountNumber, businessIdentifierCode });
		if (!externalAccountExist) {
            // specify payment rail
            const paymentRail = accountType === 'us' ? 'wire' : 'swift';

			const bridgeAccountResult = await createBridgeExternalAccount(
				userId, accountType, currency, bankName, accountOwnerName, accountOwnerType,
				firstName, lastName, businessName,
				streetLine1, streetLine2, city, state, postalCode, country,
				ibanAccountNumber, businessIdentifierCode, ibanCountryCode,
				accountNumber, routingNumber, paymentRail
			);

			if (bridgeAccountResult.status !== 200) {
				return res.status(bridgeAccountResult.status).json({
					error: bridgeAccountResult.type,
					message: bridgeAccountResult.message,
					source: bridgeAccountResult.source
				});
			}


			const newBridgeExternalAccountRecordId = v4();
			const insertResult = await supabase.from('bridge_external_accounts').insert({
				id: newBridgeExternalAccountRecordId,
				user_id: userId,
				currency: currency,
				bank_name: bankName,
				account_owner_name: accountOwnerName,
				account_owner_type: accountOwnerType,
				account_type: accountType,
				iban: ibanAccountNumber,
				account_number: accountNumber,
				routing_number: routingNumber,
				beneficiary_first_name: firstName,
				beneficiary_last_name: lastName,
				beneficiary_business_name: businessName,
				business_identifier_code: businessIdentifierCode,
				bank_country: ibanCountryCode,
				bridge_response: bridgeAccountResult.rawResponse,
				bridge_external_account_id: bridgeAccountResult.rawResponse.id
			});

			if (insertResult.error) {
				return res.status(500).json({ error: 'Internal Server Error', message: insertResult.error });
			}

			const accountProviderRecord = await insertAccountProviders(newBridgeExternalAccountRecordId, currency, "offramp", paymentRail, "BRIDGE", userId);

			return res.status(200).json({
				status: "ACTIVE",
				invalidFields: [],
				message: "Wire payment rail added successfully",
				id: accountProviderRecord.id
			});
		} else {
			const { data: providerAccountRecordData, error: providerAccountRecordError } = await supabase
				.from('account_providers')
				.select('id, payment_rail')
				.eq('account_id', externalAccountRecordId);

			if (providerAccountRecordError) {
				console.log(providerAccountRecordError);
				throw new Error("Failed to retrieve provider account records: " + providerAccountRecordError.message);
			}

			let wireRecord = providerAccountRecordData.find(record => record.payment_rail === 'wire');

			if (wireRecord) {
				return res.status(200).json({
					status: "ACTIVE",
					invalidFields: [],
					message: "Account already exists",
					id: wireRecord.id
				});
			}

			const accountProviderRecord = await insertAccountProviders(externalAccountRecordId, currency, "offramp", "wire", "BRIDGE", userId);
			return res.status(200).json({
				status: "ACTIVE",
				invalidFields: [],
				message: "Account created successfully",
				id: accountProviderRecord.id
			});
		}

	} catch (error) {
		createLog("account/createInternationalWireOfframpDestination", userId, error.message, error);
		console.error('Error in createInternationalWireOfframpDestination', error);
		return res.status(500).json({ error: 'Internal Server Error', message: error.message || "An unexpected error occurred" });
	}
};

exports.getBlindpayReceiver = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId, userId, receiverId } = req.query;
	const fields = { user_id: userId, ...(receiverId && { receiver_id: receiverId }) };

	const requiredFields = ["user_id"]
	const acceptedFields = { user_id: "string", receiver_id: "string" }

	const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
	if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: "Fields provided are either invalid or missing", invalidFields, missingFields })
	if (fields.receiver_id && !isUUID(fields.receiver_id)) return res.status(400).json({ error: "Invalid receiver_id" })
	if (!(await verifyUser(fields.user_id, profileId))) return res.status(401).json({ error: "userId not found" })

	try {
		const receiverInfo = await getReceiverInfo(fields.user_id, fields.receiver_id);
		if (fields.receiver_id && receiverInfo.count === 1) return res.status(200).json(receiverInfo.data[0]);
		return res.status(200).json(receiverInfo);
	} catch (error) {
		await createLog("account/createBlindpayReceiver", fields.userId, error.message, error);
		if (error instanceof ReceiverInfoGetError) {
			return res.status(error.status).json(error.rawResponse)
		}
		return res.status(500).json({ error: "An error occurred while creating the receiver. Please try again later." });
	}
}

exports.updateBlindpayReceiver = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId, userId, receiverId } = req.query;
	if (!userId || !receiverId) return res.status(400).json({ error: "userId or receiverId is missing" })
	const fields = req.body;
	fields.user_id = userId;
	fields.receiver_id = receiverId;
	if (!isUUID(receiverId)) return res.status(400).json({ error: "Invalid receiver_id" })
	if (!(await verifyUser(fields.user_id, profileId))) return res.status(401).json({ error: "userId not found" })

	let receiverRecord
	// upload information
	try {
		receiverRecord = await updateReceiverKYCInfo(fields)
	} catch (error) {
		if (error instanceof ReceiverInfoUploadError) {
			return res.status(error.status).json(error.rawResponse)
		}
		await createLog("account/updateBlindpayReceiver", fields.user_id, `Failed to Update Receiver Info For user: ${fields.user_id}`, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
	}

	try {
		const response = await updateReceiver(receiverRecord)

		// Insert receiver data into blindpay_receivers table
		const { error: receiverUpdateError } = await supabase
			.from('blindpay_receivers_kyc')
			.update({
				blindpay_response: response,
				kyc_status: "verifying"
			}).eq('id', receiverRecord.id);

		if (receiverUpdateError) {
			await createLog("account/updateBlindpayReceiver", fields.user_id, receiverUpdateError.message, receiverUpdateError);
			return res.status(500).json({ error: "Unexpected error happened, please contact HIFI for more information" })
		}

		const responseObject = {
			success: response.success ? response.success : false,
			id: receiverRecord.id
		};

		return res.status(200).json(responseObject);

	} catch (error) {
		await createLog("account/updateBlindpayReceiver", fields.userId, error.message, error);
		return res.status(500).json({ error: "An error occurred while creating the receiver. Please try again later." });
	}
}
