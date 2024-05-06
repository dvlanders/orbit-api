
const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');
const supabase = require('../util/supabaseClient');
const fileToBase64 = require('../util/fileToBase64');



const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;


exports.getCustomer = async (req, res) => {

	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.body;
	if (!merchantId) {
		return res.status(400).json({ error: 'merchantId is required' });
	}

	try {
		const { data: merchantData, error: merchantError } = await supabase
			.from('merchants')
			.select('bridge_id')
			.eq('id', merchantId)
			.single();


		if (merchantError) {
			throw new Error(`Database error: ${merchantError.message}`);
		}

		if (!merchantData) {
			return res.status(404).json({ error: 'No merchant found for the given merchant ID' });
		}

		const bridgeId = merchantData.bridge_id;

		const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeId}`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP status ${response.status}`);
		}

		const responseData = await response.json();
		return res.status(200).json(responseData);
	} catch (error) {
		logger.error(`Something went wrong while creating the Terms of Service link: ${error.message}`);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.message,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'GET /bridge/v0/customers/',
			})
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};


exports.createTermsOfServiceLink = async (req, res) => {

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.body;
	if (!merchantId) {
		return res.status(400).json({ error: 'merchantId is required' });
	}

	const idempotencyKey = uuidv4();

	// TODO: Save each request in bridge_tos_links_requests table in the database

	try {
		const response = await fetch(`${BRIDGE_URL}/v0/customers/tos_links`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY
			}
		});

		if (!response.ok) {
			throw new Error(`Bridge POST /customers/tos_links returned an error: ${response}`);
		}

		const responseData = await response.json();
		const sessionUrl = responseData.url;
		const redirectUri = `${process.env.FRONTEND_URL}/auth/tosredirect/${merchantId}`;
		const encodedRedirectUri = querystring.escape(redirectUri);

		const delimiter = sessionUrl.includes('?') ? '&' : '?';
		const fullUrl = `${sessionUrl}${delimiter}redirect_uri=${encodedRedirectUri}`;

		return res.status(201).json({ url: fullUrl });
	} catch (error) {
		logger.error(`Something went wrong while creating the Terms of Service link: ${error.message}`);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error,
				status: error.status,
				merchant_id: merchantId,
				endpoint: '/bridge/v0/customers/tos_links',
			})
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};


exports.createNewBridgeCustomer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, signedAgreementId } = req.body;
	if (!merchantId || !signedAgreementId) {
		return res.status(400).json({ error: 'merchantId and signedAgreementId are required' });
	}

	try {
		const { data: complianceData, error: complianceError } = await supabase
			.from('compliance')
			.select('*')
			.eq('merchant_id', merchantId)
			.single();

		if (complianceError) {
			throw new Error(`Database error: ${complianceError}`);
		}

		if (!complianceData) {
			return res.status(404).json({ error: 'No compliance data found for the given merchant ID' });
		}

		const birthDate = new Date(complianceData.date_of_birth);
		const formattedBirthDate = `${birthDate.getUTCFullYear()}-${(birthDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${birthDate.getUTCDate().toString().padStart(2, '0')}`; 	// Format date of birth from timestampz to yyyy-mm-dd

		const idempotencyKey = uuidv4();

		const requestBody = {
			type: complianceData.type,
			first_name: complianceData.legal_first_name,
			last_name: complianceData.legal_last_name,
			email: complianceData.compliance_email,
			phone: complianceData.compliance_phone,
			address: {
				street_line_1: complianceData.address_line_1,
				street_line_2: complianceData.address_line_2,
				city: complianceData.city,
				state: complianceData.state_province_region,
				postal_code: complianceData.postal_code,
				country: complianceData.country
			},
			signed_agreement_id: signedAgreementId,
			birth_date: formattedBirthDate,
			tax_identification_number: complianceData.tin
		};

		const paths = [complianceData.gov_id_front_path, complianceData.gov_id_back_path, complianceData.proof_of_address_path];
		const fileUrls = await Promise.all(paths.map(async (path) => {
			const { data, error } = await supabase.storage.from('compliance_id').createSignedUrl(path, 200); // Signed URL expires in 200 seconds
			if (error || !data) {
				console.log(`No file found at ${path}`);
				return null;
			}
			return data.signedUrl;
		}));


		// Conditionally adding images to the request body
		if (fileUrls[0]) { // Checking for the front image
			requestBody.gov_id_image_front = await fileToBase64(fileUrls[0]);

		}
		if (fileUrls[1]) { // Checking for the back image
			requestBody.gov_id_image_back = await fileToBase64(fileUrls[1]);
		}
		if (fileUrls[2]) { // Checking for the proof of address image
			requestBody.proof_of_address_document = await fileToBase64(fileUrls[2]);
		}

		const response = await fetch(`${BRIDGE_URL}/v0/customers`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		const responseBody = await response.json();


		const { error: merchantUpdateError } = await supabase
			.from('merchants')
			.update([{ bridge_id: responseBody.id }])
			.match({ id: merchantId })

		if (merchantUpdateError) throw merchantUpdateError;

		if (responseBody.status === 'active') {
			const { error: approveTimestampError } = await supabase
				.from('compliance')
				.update([{ bridge_customer_approved_at: new Date(), bridge_response: responseBody }])
				.match({ merchant_id: merchantId })

			if (approveTimestampError) throw approveTimestampError;
		}


		if (!response.ok) {
			console.error('HTTP error', response.status, responseBody.message, responseBody.source, responseBody);
			return res.status(response.status).json({
				error: responseBody.message || 'Error processing request',
				source: responseBody.source || 'response.source not provided by Bridge API. Reach out to Bridge for further debugging',
				bridgeResponse: responseBody
			});
		}

		return res.status(200).json(responseBody);

	} catch (error) {
		logger.error(`Error in createNewBridgeCustomer: ${error}`);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.message,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /bridge/v0/customers',
			})
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`
		});
	}
};

exports.createVirtualAccount = async (req, res) => {

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, bridgeId, sourceCurrency, sourcePaymentRail, destinationCurrency, destinationPaymentRail, destinationWalletAddress, developerFeePercent, destinationBlockchainMemo } = req.body;
	if (!merchantId || !bridgeId || !sourceCurrency || !sourcePaymentRail || !destinationCurrency || !destinationPaymentRail || !destinationWalletAddress) {
		return res.status(400).json({ error: 'merchantId, bridgeId, sourceCurrency, sourcePaymentRail, destinationCurrency, destinationPaymentRail, and destinationWalletAddress are required' });
	}

	const idempotencyKey = uuidv4();

	const bodyObject = JSON.stringify({
		developer_fee_percent: developerFeePercent || '0.0',
		source: {
			currency: sourceCurrency,
			payment_rail: sourcePaymentRail
		},
		destination: {
			currency: destinationCurrency,
			payment_rail: destinationPaymentRail,
			address: destinationWalletAddress,
			blockchain_memo: destinationBlockchainMemo || ''
		},
	});



	try {
		console.log('bodyObject for virtual account: ', bodyObject)

		const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeId}/virtual_accounts`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'
			},
			body: bodyObject
		});




		const virtualAccountResponseData = await response.json();
		if (!response.ok) {
			const errorDetails = {
				message: virtualAccountResponseData.message || `HTTP status ${response.status}`,
				code: virtualAccountResponseData.code || 'Unknown_Error',
				name: virtualAccountResponseData.name || 'Response_Error',
				response: {
					status: response.status,
					statusText: response.statusText,
					url: response.url,
					body: virtualAccountResponseData
				}
			};

			throw new Error(JSON.stringify(errorDetails));
		}
		console.log('virtualAccountResponseData: ', virtualAccountResponseData)
		const { error: virtualAccountError } = await supabase
			.from('bridge_virtual_accounts')
			.insert([{
				merchant_id: merchantId,
				source_currency: sourceCurrency,
				source_payment_rail: sourcePaymentRail,
				destination_currency: destinationCurrency,
				destination_payment_rail: destinationPaymentRail,
				destination_wallet_address: destinationWalletAddress,
				bridge_virtual_account_id: virtualAccountResponseData.id,
				developer_fee_percent: developerFeePercent || '0.0',
				deposit_instructions_bank_name: virtualAccountResponseData.source_deposit_instructions.bank_name,
				deposit_instructions_bank_address: virtualAccountResponseData.source_deposit_instructions.bank_address,
				deposit_instructions_bank_routing_number: virtualAccountResponseData.source_deposit_instructions.bank_routing_number,
				deposit_instructions_bank_account_number: virtualAccountResponseData.source_deposit_instructions.bank_account_number,
				destination_blockchain_memo: destinationBlockchainMemo || '',
				bridge_response: virtualAccountResponseData
			}]);

		if (virtualAccountError) throw virtualAccountError;

		return res.status(201).json(virtualAccountResponseData);

	} catch (error) {
		logger.error(`Something went wrong while creating the Bridge virtual account: ${error.message}`);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.message,
				status: error.status,
				merchant_id: merchantId,
				endpoint: '/bridge/v0/customers/virtual_account',
			})
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};


exports.createExternalAccount = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, bridgeId, currency, bankName, accountOwnerName, accountNumber, routingNumber, businessIdentifierCode, bankCountry, accountType, accountOwnerType, beneficiaryFirstName, beneficiaryLastName, beneficiaryBusinessName, beneficiaryStreetLine1, beneficiaryStreetLine2, beneficiaryCity, beneficiaryState, beneficiaryPostalCode, beneficiaryCountry } = req.body;

	if (!merchantId || !bridgeId || !currency || !bankName || !accountOwnerName || !accountNumber || !accountType || !accountOwnerType || bankCountry) {
		return res.status(400).json({ error: 'merchantId, bridgeId, currency, bankName, accountOwnerName, accountNumber, accountType, bankCountry, and accountOwnerType are required' });
	}

	const idempotencyKey = uuidv4();
	const bodyObject = {
		currency: currency,
		bank_name: bankName,
		account_owner_name: accountOwnerName,
		account_type: accountType,
		account_owner_type: accountOwnerType,
	};

	if (accountType === 'iban') {
		bodyObject.iban = {
			account_number: accountNumber,
			bic: businessIdentifierCode,
			country: bankCountry
		};
	} else if (accountType === 'us') {
		bodyObject.account = {
			account_number: accountNumber,
			routing_number: routingNumber
		};
		bodyObject.address = {
			street_line_1: beneficiaryStreetLine1,
			street_line_2: beneficiaryStreetLine2,
			city: beneficiaryCity,
			state: beneficiaryState,
			postal_code: beneficiaryPostalCode,
			country: beneficiaryCountry
		};
	}

	if (accountOwnerType === 'individual') {
		bodyObject.first_name = beneficiaryFirstName;
		bodyObject.last_name = beneficiaryLastName;
	} else if (accountOwnerType === 'business') {
		bodyObject.business_name = beneficiaryBusinessName;

	}

	let response;

	try {
		response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeId}/external_accounts`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(bodyObject)
		});

		const externalAccountResponseData = await response.json();

		if (!response.ok) {
			const errorDetails = {
				message: externalAccountResponseData.message || `HTTP status ${response.status}`,
				code: externalAccountResponseData.code || 'Unknown_Error',
				name: externalAccountResponseData.name || 'Response_Error',
				response: {
					status: response.status,
					statusText: response.statusText,
					url: response.url,
					body: externalAccountResponseData
				}
			};

			throw new Error(JSON.stringify(errorDetails));
		}



		await supabase
			.from('bridge_external_accounts')
			.insert([{
				merchant_id: merchantId,
				currency: currency,
				bank_name: bankName,
				account_owner_name: accountOwnerName,
				account_number: accountNumber,
				routing_number: routingNumber,
				account_type: accountType,
				business_identifier_code: businessIdentifierCode,
				bank_country: bankCountry,
				account_owner_type: accountOwnerType,
				beneficiary_first_name: beneficiaryFirstName,
				beneficiary_last_name: beneficiaryLastName,
				beneficiary_business_name: beneficiaryBusinessName,
				beneficiary_street_line_1: beneficiaryStreetLine1,
				beneficiary_street_line_2: beneficiaryStreetLine2,
				beneficiary_city: beneficiaryCity,
				beneficiary_state: beneficiaryState,
				beneficiary_postal_code: beneficiaryPostalCode,
				beneficiary_country: beneficiaryCountry,
				bridge_response: externalAccountResponseData
			}]);

		return res.status(201).json(externalAccountResponseData);

	} catch (error) {
		logger.error(`Something went wrong while creating the Bridge virtual account: ${error.message}`);

		// Parse the error message back to an object to extract the structured data
		let errorDetails;
		try {
			errorDetails = JSON.parse(error.message);
		} catch (parseError) {
			// Fallback if the error message is not JSON (shouldn't happen, but just in case)
			errorDetails = {
				message: error.message,
				code: 'Error_Parsing_Failed',
				name: 'Parse_Error',
				response: {
					status: 500,
					statusText: 'Internal Server Error',
					url: req.url,
					body: { error: error.message }
				}
			};
		}

		// Log the detailed error to your database
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: JSON.stringify(errorDetails),
				status: errorDetails.response.status || 500,
				merchant_id: merchantId,
				endpoint: '/bridge/v0/customers/virtual_account',
			});

		// Return a structured error response to the client
		return res.status(errorDetails.response.status || 500).json({
			error: errorDetails.message,
			code: errorDetails.code,
			details: errorDetails.response
		});
	}
};
