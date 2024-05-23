
const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');
const supabase = require('../util/supabaseClient');
const fileToBase64 = require('../util/fileToBase64');

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

// const BRIDGE_API_KEY = 'sk-test-c9a27e4d4939ec14536eec55ab295b67';
// const BRIDGE_URL = 'https://api.sandbox.bridge.xyz';
exports.getVirtualAccountHistory = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, virtualAccountId, transactionHash, limit, startingAfter, endingBefore, eventType } = req.query;
	if (!merchantId || !virtualAccountId) return res.status(400).json({ error: 'merchantId and virtualAccountId are required' });

	const { data: merchantData, error: merchantError } = await supabase
		.from('merchants')
		.select('bridge_id')
		.eq('id', merchantId)
		.single();


	console.log('merchantData', merchantData)

	if (merchantError) {
		throw new Error(`Database error: ${JSON.stringify(merchantError)}`);
	}
	if (!merchantData) {
		throw new Error('No merchant found for the given merchant ID');
	}

	const bridgeId = merchantData.bridge_id;

	try {
		const queryParams = new URLSearchParams();
		for (const [key, value] of Object.entries(req.query)) {
			if (key !== 'bridgeId' && key !== 'virtualAccountId') {
				queryParams.set(key, value);
			}
		}
		const url = `${BRIDGE_URL}/v0/customers/${bridgeId}/virtual_accounts/${virtualAccountId}/history?${queryParams.toString()}`;
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY,
				'accept': 'application/json'
			}
		});

		if (!response.ok) {
			const data = await response.json()
			console.error(data)
			throw new Error(JSON.stringify(data));
		}

		const responseData = await response.json();
		console.log('responseData microdeposts', responseData)

		return res.status(200).json(responseData);
	} catch (error) {
		logger.error(`Something went wrong while getting the bridge virtual account history: ${JSON.stringify(error)}`);

		logger.error(`Error object: ${JSON.stringify(error, null, 2)}`);

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: JSON.stringify(error, null, 2),
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'GET /virtual_account/history',
			})
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};


exports.getCustomer = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.query;
	if (!merchantId) return res.status(400).json({ error: 'merchantId is required' });

	try {
		const { data: merchantData, error: merchantError } = await supabase
			.from('merchants')
			.select('bridge_id')
			.eq('id', merchantId)
			.single();


		if (merchantError) {
			throw new Error(`Database error: ${JSON.stringify(merchantError)}`);
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
			const data = await response.json()
			console.error(data)
			throw new Error(JSON.stringify(data));
		}

		const responseData = await response.json();
		return res.status(200).json(responseData);
	} catch (error) {
		logger.error(`Something went wrong while get bridge customer: ${error.message}`);

		logger.error(`Error object: ${JSON.stringify(error, null, 2)}`);

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: JSON.stringify(error, null, 2),
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'GET /bridge/v0/customers/',
			})
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};

exports.getDrainHistory = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, bridgeId, liquidationAddressId, transactionHash } = req.query;

	if (!merchantId || !bridgeId || !liquidationAddressId || !transactionHash) {
		return res.status(400).json({ error: 'merchantId, bridgeId, liquidationAddressId, and transactionHash are required' });
	}

	try {
		const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeId}/liquidation_addresses/${liquidationAddressId}/drains`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('Error response:', errorData);
			return res.status(response.status).json({ error: 'Failed to fetch drain history' });
		}

		const responseData = await response.json();

		// console.log(responseData)
		const items = Array.isArray(responseData.data) ? responseData.data : [];
		// console.log('items', items)
		const item = items.find(item => item.deposit_tx_hash === transactionHash);

		if (!item) {
			return res.status(404).json({ error: 'No transaction found with the specified transactionHash' });
		}
		const withdrawalStatus = item.state;

		// Update the bridge_withdraw_status in the withdrawals table
		const { data: updateData, error: updateError } = await supabase
			.from('withdrawals')
			.update({ bridge_withdraw_status: withdrawalStatus })
			.eq('transaction_hash', transactionHash)
			.select();

		if (updateError) {
			console.error('Update error:', updateError);
			throw new Error(`Failed to update withdrawal status: ${JSON.stringify(updateError)}`);
		}

		// Ensure updateData is properly handled
		if (!updateData || !Array.isArray(updateData) || updateData.length === 0) {
			console.error('No withdrawal found or no updates made for the specified transactionHash.');
			return res.status(404).json({ error: 'No withdrawal found with the specified transactionHash' });
		}

		return res.status(200).json({ message: 'Withdrawal status updated successfully', withdrawalStatus: withdrawalStatus });
	} catch (error) {
		console.error('Something went wrong while getting drain history:', error);

		// Log the error to the logs table, catching any potential logging errors
		try {
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: error.toString(),
					status: 'error',
					merchant_id: merchantId,
					endpoint: 'GET /drains',
				});

			if (logError) {
				console.error('Failed to log error:', logError);
			}
		} catch (logErr) {
			console.error('Failed to log to database:', logErr);
		}

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
			throw new Error(`Bridge POST /customers/tos_links returned an error: ${JSON.stringify(response)}`);
		}


		const responseData = await response.json();
		const sessionUrl = responseData.url;
		const base_url = process.env.FRONTEND_URL
		// DEV ONLY
		// const base_url = "http://localhost:3000"
		const redirectUri = `${base_url}/auth/tosredirect/${merchantId}`;

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
			throw new Error(`Database error: ${JSON.stringify(complianceError)}`);
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
				.update([{ bridge_status: responseBody.status, bridge_response: responseBody }])
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
				log: error,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /bridge/v0/customers',
			})
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`
		});
	}
};


exports.updateBridgeCustomer = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.body;
	if (!merchantId) {
		return res.status(400).json({ error: 'merchantId is required' });
	}

	try {
		const { data: complianceData, error: complianceError } = await supabase
			.from('merchants')
			.select('*, compliance (*)')
			.eq('id', merchantId)
			.single();

		if (complianceError) {
			await logErrorToDatabase(merchantId, 'Failed to fetch compliance data', complianceError);
			throw new Error(`Database error: ${JSON.stringify(complianceError)}`);
		}

		if (!complianceData) {
			return res.status(404).json({ error: 'No compliance data found for the given merchant ID' });
		}


		const formattedBirthDate = new Date(complianceData.compliance.date_of_birth).toISOString().split('T')[0]; // YYYY-MM-DD
		const requestBody = {
			type: complianceData.compliance.type,
			first_name: complianceData.compliance.legal_first_name,
			last_name: complianceData.compliance.legal_last_name,
			email: complianceData.compliance.compliance_email,
			phone: complianceData.compliance.compliance_phone,
			address: {
				street_line_1: complianceData.compliance.address_line_1,
				street_line_2: '',
				city: complianceData.compliance.city,
				state: complianceData.compliance.state_province_region,
				postal_code: complianceData.compliance.postal_code,
				country: complianceData.compliance.country
			},
			birth_date: formattedBirthDate,
			tax_identification_number: complianceData.compliance.tin,
			signed_agreement_id: complianceData.compliance.bridge_signed_agreement_id,

		};


		const paths = [complianceData.compliance.gov_id_front_path, complianceData.compliance.gov_id_back_path, complianceData.compliance.proof_of_address_path];
		console.log('paths', paths)
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

		console.log('bridge url', `${BRIDGE_URL}/v0/customers/${complianceData.bridge_id}`)

		const response = await fetch(`${BRIDGE_URL}/v0/customers/${complianceData.bridge_id}`, {
			method: 'PUT',
			headers: {
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});


		if (!response.ok) {
			const errorResponse = await response.json();
			console.log('not okay response from bridge:', errorResponse)

			await logErrorToDatabase(merchantId, { status: response.status, bridge_response: errorResponse }, 'PUT /bridge/v0/customers/update');
			return res.status(response.status).json({
				bridge_response: errorResponse
			});
		}

		const responseData = await response.json();

		return res.status(200).json(responseData);
	} catch (error) {
		await logErrorToDatabase(merchantId, error, 'PUT /bridge/v0/customers/update');
		return res.status(500).json({
			error: `Internal Server Error: ${error.message}`,
			details: error
		});
	}
};


async function logErrorToDatabase(merchantId, log, endpoint) {
	await supabase.from('logs').insert({
		merchant_id: merchantId,
		log: JSON.stringify(log),
		endpoint: endpoint
	});
}


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

	const {
		merchantId,
		bridgeId,
		currency,
		bankName,
		accountOwnerName,
		accountNumber,
		routingNumber,
		businessIdentifierCode,
		bankCountry,
		accountType,
		accountOwnerType,
		beneficiaryFirstName,
		beneficiaryLastName,
		beneficiaryBusinessName,
		beneficiaryStreetLine1,
		beneficiaryStreetLine2,
		beneficiaryCity,
		beneficiaryState,
		beneficiaryPostalCode,
		beneficiaryCountry
	} = req.body;

	console.log('req.body', req.body);

	const requiredFields = [
		'merchantId',
		'bridgeId',
		'currency',
		'bankName',
		'accountOwnerName',
		'accountNumber',
		'accountType',
		'accountOwnerType',
		// 'bankCountry'
	];

	const missingFields = requiredFields.filter(field => !req.body[field]);

	if (missingFields.length > 0) {
		console.log('Missing required fields:', missingFields.join(', '));
		return res.status(400).json({
			error: `Missing required fields: ${missingFields.join(', ')}`
		});
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
		bodyObject.accountOwnerType = accountOwnerType;
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
				bridge_response: externalAccountResponseData,
				bridge_external_account_id: externalAccountResponseData.id
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


exports.createLiquidationAddress = async (req, res) => {

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, externalAccountId, bridgeId, chain, currency, destinationSepaReference, destinationPaymentRail, destinationCurrency } = req.body;
	if (!merchantId || !bridgeId || !chain || !currency || !externalAccountId || !destinationPaymentRail || !destinationCurrency) {
		return res.status(400).json({ error: 'merchantId, bridgeId, chain, currency, externalAccountId, destinationPaymentRail, and destinationCurrency are required' });
	}

	const idempotencyKey = uuidv4();


	const bodyObject = {
		chain: chain,
		currency: currency,
		external_account_id: externalAccountId,
		destination_payment_rail: destinationPaymentRail,
		destination_currency: destinationCurrency
	};

	if (destinationSepaReference) {
		bodyObject.destination_sepa_reference = destinationSepaReference;
	}

	try {
		console.log('idempotencyKey', idempotencyKey)
		console.log('bodyObject about to be sent', bodyObject)
		console.log('bridge url', `${BRIDGE_URL}/v0/customers/${bridgeId}/liquidation_addresses`)

		const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeId}/liquidation_addresses`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'

			},
			body: JSON.stringify(bodyObject)
		});


		if (response.status !== 201) {
			const responseData = await response.json();
			console.error('Bridge POST /liquidation_addresses error:', responseData);

			throw new Error(`Bridge POST /liquidation_addresses returned an error: ${JSON.stringify(responseData)}`);
		}

		const responseData = await response.json();

		console.log('liquidation address create responseData', responseData);

		const { data: liquidationAddressData, error: liquidationAddressError } = await supabase
			.from('bridge_liquidation_addresses')
			.insert({
				chain: chain,
				currency: currency,
				external_account_id: externalAccountId,
				destination_sepa_reference: destinationSepaReference,
				destination_payment_rail: destinationPaymentRail,
				destination_currency: destinationCurrency,
				merchant_id: merchantId,
				address: responseData.address,
				bridge_response: JSON.stringify(responseData),
				liquidation_address_id: responseData.id
			})
			.select();

		if (liquidationAddressError) {
			throw new Error(`Database error: ${JSON.stringify(liquidationAddressError)}`);
		}

		return res.status(201).json({ bridgeResponse: responseData, bridge_liquidation_address: liquidationAddressData });
	} catch (error) {
		logger.error(`Something went wrong while creating the liquidation address: ${JSON.stringify(error)}`);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /liquidation_addresses',
			})
		return res.status(500).json({
			error: `${error}`,
		});
	}
};


exports.getHostedKycLinkForSepaEndorsement = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.query;
	if (!merchantId) return res.status(400).json({ error: 'merchantId is required' });

	const { data: merchantData, error: merchantError } = await supabase
		.from('merchants')
		.select('bridge_id')
		.eq('id', merchantId)
		.single();


	console.log('merchantData', merchantData)

	if (merchantError) {
		throw new Error(`Database error: ${JSON.stringify(merchantError)}`);
	}
	if (!merchantData) {
		throw new Error('No merchant found for the given merchant ID');
	}

	const bridgeId = merchantData.bridge_id;

	try {

		const url = `${BRIDGE_URL}/v0/customers/${bridgeId}/kyc_link?endorsement=sepa`;
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY,
				'accept': 'application/json'
			}
		});

		if (!response.ok) {
			const data = await response.json()
			console.error(data)
			throw new Error(JSON.stringify(data));
		}

		const responseData = await response.json();

		return res.status(200).json(responseData);
	} catch (error) {
		logger.error(`${JSON.stringify(error)}`);

		logger.error(`${JSON.stringify(error, null, 2)}`);

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: JSON.stringify(error, null, 2),
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'GET /hosted_kyc_link',
			})
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};