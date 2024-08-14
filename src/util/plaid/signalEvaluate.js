const fetch = require('node-fetch');
const { v4: uuidv4 } = require("uuid");
const supabase = require('../supabaseClient');

/**
 * Uses Bastion to send MATIC on Polygon Mainnet
 * @param {string} toWalletAddress - The address of the recipient's wallet.
 * @param {string} amount - The amount of tokens to send / 10e6
 * @returns {Promise<Object>} - A promise that resolves to the transaction result.
 */

const PLAID_URL = process.env.PLAID_URL;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;

// async function getSignalEvaluate(merchantId, plaidAccountId, ipAddress, userAgent, userPresent, amount) {

async function getSignalEvaluate(merchantId, plaidAccountId, amount) {

	// get data from compliance table to be passed to plaid to evaluate user's risk score
	const { data: complianceData, error: complianceError } = await supabase
		.from('compliance')
		.select('*')
		.eq('merchant_id', merchantId)
		.single();

	if (complianceError || !complianceData || complianceData.length === 0) {
		logger.error(`DB error while querying compliance table: ${JSON.stringify(complianceError)}`);
		throw new Error(`DB error while querying compliance table: ${JSON.stringify(complianceError)}`);
	}

	// get plaid account data
	const { data: plaidData, error: plaidError } = await supabase
		.from('plaid_accounts')
		.select('plaid_access_token')
		.eq('account_id', plaidAccountId)
		.single();

	if (plaidError || !plaidData || plaidData.length === 0) {
		logger.error(`DB error while querying plaidData: ${JSON.stringify(plaidData)}`);
		throw new Error(`DB error while querying plaidData: ${JSON.stringify(plaidData)}`);
	}

	const url = `${PLAID_URL}/signal/evaluate`;

	const userObject = {
		name: {
			given_name: complianceData.legal_first_name,
			family_name: complianceData.legal_last_name,
		},
		phone_number: complianceData.compliance_phone,
		email_address: complianceData.compliance_email,
		address: {
			street: complianceData.address_line_1,
			city: complianceData.city,
			region: complianceData.state_province_region,
			postal_code: complianceData.postal_code,
			country: complianceData.country,
		}
	};
	// generate client transaction id
	const clientTransactionId = uuidv4();

	const body = {
		client_id: PLAID_CLIENT_ID,
		secret: PLAID_SECRET,
		access_token: plaidData.plaid_access_token,
		account_id: plaidAccountId,
		client_transaction_id: clientTransactionId,
		amount: Number(amount),
		// client_user_id: merchantId,
		user: userObject,
		// device: {
		// 	ip_address: ipAddress,
		// 	user_agent: userAgent,
		// },
		// user_present: userPresent
	};

	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();
		if (!response.ok) {
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `Error while fetching plaid bank account evaluation: ${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'Util /plaid/signal/evaluate',
				});

			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}


		// William todo: log the response from plaid signal evaluate into the database
		const scores = data.scores


		const { data: plaidEvaluationData, error: plaidEvaluationError } = await supabase
			.from('plaid_bank_account_evaluation')
			.insert(
				{
					request_id: scores.request_id,
					customer_initiated_return_risk_score: scores.customer_initiated_return_risk.score,
					customer_initiated_return_risk_risk_tier: scores.customer_initiated_return_risk.risk_tier,
					bank_initiated_return_risk_score: scores.bank_initiated_return_risk.score,
					bank_initiated_return_risk_risk_tier: scores.bank_initiated_return_risk.risk_tier,
					plaid_signal_evaluate_response: data,
					warnings: scores.warnings,
					risk_profile: scores.risk_profile
				},
			)
			.select();

		if (plaidEvaluationError) {
			console.error("Error while inserting plaid bank account evaluation record: ", JSON.stringify(plaid_evaluation_record_error));
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `Error while inserting plaid bank account evaluation record: ${JSON.stringify(plaidEvaluationError)}`,
					merchant_id: merchantId,
					endpoint: 'getPlaidEvaluate util function'
				});

			throw JSON.stringify(plaidEvaluationError);
		}

		return { data: data };

	} catch (error) {
		console.error("Error during plaid signal evaluation:", JSON.stringify(error));

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.toString(),
				merchant_id: merchantId,
				endpoint: 'getPlaidEvaluate util function'
			});

		throw JSON.stringify(error);
	}
}

module.exports = getSignalEvaluate;
