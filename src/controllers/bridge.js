
const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');
const supabase = require('../util/supabaseClient');
const fileToBase64 = require('../util/fileToBase64');



const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

exports.createTermsOfServiceLink = async (req, res) => {

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.body;
	if (!merchantId) {
		return res.status(400).json({ error: 'merchantId is required' });
	}

	const idempotencyKey = uuidv4();

	try {
		const response = await fetch(`${BRIDGE_URL}/v0/customers/tos_links`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP status ${response.status}`);
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
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};

// in the frontend, save the signed agreement id in a new table

exports.createNewBridgeCustomer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, signedAgreementId } = req.body;
	if (!merchantId || !signedAgreementId) {
		return res.status(400).json({ error: 'merchantId and signedAgreementId are required' });
	}

	// Query Supabase to get the merchant details
	try {
		const { data: complianceData, error: complianceError } = await supabase
			.from('compliance')
			.select('*')
			.eq('merchant_id', merchantId)
			.single();

		if (complianceError) {
			throw new Error(`Database error: ${complianceError.message}`);
		}

		if (!complianceData) {
			return res.status(404).json({ error: 'No compliance data found for the given merchant ID' });
		}

		// Format date of birth from timestampz to yyyy-mm-dd
		const birthDate = new Date(complianceData.date_of_birth);
		const formattedBirthDate = `${birthDate.getUTCFullYear()}-${(birthDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${birthDate.getUTCDate().toString().padStart(2, '0')}`;


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

		if (complianceData.image_front_base64) {
			requestBody.gov_id_image_front = complianceData.image_front_base64;
		}
		if (complianceData.image_back_base64) {
			requestBody.gov_id_image_back = complianceData.image_back_base64;
		}

		// get the image from supabase storage and convert it to base64 to be sent to bridge request body
		// if (complianceData.id_type === 'passport') {
		// 	try {
		// 		const { data, error } = await supabase
		// 			.storage
		// 			.from('compliance_id')
		// 			.createSignedUrl(`${merchantId}/Passport_front.png`, 1814400) // Signed url expires in 3 weeks


		// 		if (error) {
		// 			throw new Error(`Error fetching file from storage: ${fileError}`);
		// 		}

		// 		if (!data) {
		// 			return res.status(404).json({ error: 'No storage data found for the given merchant ID' });
		// 		}

		// 		// convert the signed url to 
		// 		requestBody.gov_id_image_front = await fileToBase64(data.signedUrl);

		// 	} catch (error) {
		// 		logger.error(`Error getting passport file: ${error.message}`);
		// 		return res.status(500).json({
		// 			error: `Something went wrong: ${error.message}`
		// 		});
		// 	}

		// } else if (complianceData.id_type === 'drivers_license') { // FIXME: add all of the logic for each of the id types
		// 	try {
		// 		const { data: fileData, error: fileError } = await supabase
		// 			.storage
		// 			.from('compliance_id')
		// 			.createSignedUrl(`${merchantId}/Drivers_license_front.png`, 1814400) // Signed url expires in 3 weeks

		// 		if (fileError) {
		// 			throw new Error(`Error fetching file from storage: ${fileError}`);
		// 		}

		// 		if (!fileData) {
		// 			return res.status(404).json({ error: 'No storage data found for the given merchant ID' });
		// 		}

		// 	} catch (error) {
		// 		logger.error(`Error getting drivers license file: ${error.message}`);
		// 		return res.status(500).json({
		// 			error: `Something went wrong: ${error.message}`
		// 		});
		// 	}

		// 	requestBody.gov_id_image_front = complianceData.ssn;
		// } else {
		// 	return res.status(400).json({ error: 'Unrecognized ID type in compliance record' });
		// }


		console.log('request body that is about to be sent:', requestBody)
		const response = await fetch(`${BRIDGE_URL}/v0/customers`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			throw new Error(`HTTP status ${response.status}`);
		}

		const responseBody = await response.json();
		return res.status(200).json(responseBody);

	} catch (error) {
		logger.error(`Error in createNewBridgeCustomer: ${error}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`
		});
	}
};