const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const FormData = require('form-data');


/**
 * Create a new request for payment from another user
 */
exports.createRequest = async (req, res) => {

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, requesteeEmail, amount, chain, fiatCurrency } = req.body;

	if (!merchantId || !requesteeEmail || !amount || !chain || !fiatCurrency) {
		return res.status(400).json({ error: 'merchantId, requesteeEmail, amount, chain, and fiatCurrency are required' });
	}


	try {
		const { data: requesteeProfileData, error: requesteeProfileError } = await supabase
			.from('profiles')
			.select('merchant_id')
			.eq('email', requesteeEmail);

		if (requesteeProfileError) {
			logger.error(`DB error while querying profiles table: ${requesteeProfileError}`);
			throw new Error(`DB error while querying profiles table: ${requesteeProfileError}`);
		}
		if (!requesteeProfileData || requesteeProfileData.length === 0) {
			logger.info(`No profiles record found for ${requesteeEmail}, creating new merchant`);

			// Sign in with OTP and create a new user, triggering on_auth_user_created which spins up the profiles and merchants table records
			const { error: newRequesteeUserError } =
				await supabase.auth.signInWithOtp({
					email: requesteeEmail,
					options: {
						shouldCreateUser: true,
					},
				});


			if (newRequesteeUserError) {
				logger.error(`Error creating new user: ${newRequesteeUserError}`);
				throw new Error(`Error creating new user: ${newRequesteeUserError}`);
			}

			// Neccesary to poll for the new profile record to be created by the db trigger
			const waitForProfile = async () => {
				for (let i = 0; i < 10; i++) { // Try up to 10 times with a 5 second delay
					const { data: profileData, error: profileError } = await supabase
						.from('profiles')
						.select('merchant_id')
						.eq('email', requesteeEmail);

					if (profileError) {
						logger.error(`DB error while polling profiles table: ${profileError.message}`);
						throw new Error(`DB error while polling profiles table: ${profileError.message}`);
					}

					if (profileData.length > 0) return profileData[0].merchant_id;
					await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before the next poll
				}

				throw new Error("Timeout waiting for profile creation.");
			};

			requesteeMerchantId = await waitForProfile();
			const { data: createRequestData, error: createRequestError } = await supabase
				.from('onchain_requests')
				.insert({
					requester_merchant_id: merchantId,
					requestee_merchant_id: requesteeMerchantId,
					requestee_email: requesteeEmail,
					amount: amount,
					chain: chain,
					fiat_currency: fiatCurrency

				})
				.select()
				.single()
				;


			if (createRequestError) {
				logger.error(`DB error while creating new request: ${createRequestError}`);
				throw new Error(`DB error while creating new request: ${createRequestError}`);
			}

			return res.status(200).json({
				message: 'Request created successfully',
				data: createRequestData,
			});



		} else { // merchant id for the requestee has been found
			requesteeMerchantId = requesteeProfileData[0].merchant_id;


			const { data: createRequestData, error: createRequestError } = await supabase
				.from('onchain_requests')
				.insert({
					requester_merchant_id: merchantId,
					requestee_merchant_id: requesteeMerchantId,
					requestee_email: requesteeEmail,
					amount: amount,
					chain: chain,
					fiat_currency: fiatCurrency
				})
				.select()
				.single()
				;

			if (createRequestError) {
				logger.error(`DB error while creating new request: ${createRequestError}`);
				throw new Error(`DB error while creating new request: ${createRequestError}`);
			}


			return res.status(200).json({
				message: 'Request created successfully',
				data: createRequestData,
			});

		}
	} catch (error) {
		console.error(` ${error}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: `${error}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /request/create',
			});


		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}



};

exports.rejectRequest = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const { merchantId, onchainRequestId } = req.body;

		if (!merchantId || !onchainRequestId) {
			return res.status(400).json({ error: 'merchantId, onchainRequestId are required' });
		}

		let { data: onchain_requests, error: onchain_requests_error } = await supabase
			.from('onchain_requests')
			.select('status')
			.eq('requestee_merchant_id', merchantId)
			.eq('id', onchainRequestId)
			.maybeSingle()

		if (onchain_requests_error) throw onchain_requests_error
		if (!onchain_requests) return res.status(404).json({ error: 'record not found' });
		if (onchain_requests.status != "CREATED") return res.status(400).json({ error: 'Reject not allowed' });


		let { data: updated_onchain_requests, error: updated_onchain_requests_error } = await supabase
			.from('onchain_requests')
			.update({ status: 'REJECTED' })
			.eq('requestee_merchant_id', merchantId)
			.eq('id', onchainRequestId)
			.select('*')
			.maybeSingle()
		
		if (updated_onchain_requests_error) throw updated_onchain_requests_error
		if (!updated_onchain_requests) return res.status(404).json({ error: 'record not found' });

		return res.status(200).json({messgae: "Reject request success"})

	}catch (error){
		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`})
	}
	
			

}

exports.cancelRequest = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const { merchantId, onchainRequestId } = req.body;

		if (!merchantId || !onchainRequestId) {
			return res.status(400).json({ error: 'merchantId, onchainRequestId are required' });
		}

		let { data: onchain_requests, error: onchain_requests_error } = await supabase
			.from('onchain_requests')
			.select('status')
			.eq('requester_merchant_id', merchantId)
			.eq('id', onchainRequestId)
			.maybeSingle()

		if (onchain_requests_error) throw onchain_requests_error
		if (!onchain_requests) return res.status(404).json({ error: 'record not found' });
		if (onchain_requests.status != "CREATED") return res.status(400).json({ error: 'Cancel not allowed' });


		let { data: updated_onchain_requests, error: updated_onchain_requests_error } = await supabase
			.from('onchain_requests')
			.update({ status: 'CANCELED' })
			.eq('requester_merchant_id', merchantId)
			.eq('id', onchainRequestId)
			.select('*')
			.maybeSingle()
		
		if (updated_onchain_requests_error) throw updated_onchain_requests_error
		if (!updated_onchain_requests) return res.status(404).json({ error: 'record not found' });

		return res.status(200).json({messgae: "Cancel request success"})

	}catch (error){
		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`})
	}
	
			

}


