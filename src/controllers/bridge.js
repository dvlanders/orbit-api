
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


exports.createNewBridgeCustomer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, signedAgreementId } = req.body;
	if (!merchantId || !signedAgreementId) {
		return res.status(400).json({ error: 'MerchantId and signedAgreementId are required' });
	}

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

		const paths = [`${merchantId}/${complianceData.id_type}_front.png`, `${merchantId}/${complianceData.id_type}_back.png`];
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


		const { error: approveTimestampError } = await supabase
			.from('compliance')
			.update([{ bridge_customer_approved_at: new Date() }])
			.match({ merchant_id: merchantId })

		if (approveTimestampError) throw approveTimestampError;

		if (!response.ok) {
			console.error('HTTP error', response.status, responseBody.message);
			return res.status(response.status).json({
				error: responseBody.message || 'Error processing request',
				source: responseBody.source || 'response.source not provided by Bridge API. Reach out to Bridge for further debugging'
			});
		}

		return res.status(200).json(responseBody);

	} catch (error) {
		logger.error(`Error in createNewBridgeCustomer: ${error}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`
		});
	}
};