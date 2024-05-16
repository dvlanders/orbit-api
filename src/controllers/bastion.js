const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require("uuid");
const { request } = require('express');
const fundMaticPolygon = require('../util/bastion/fundMaticPolygon');
const { bastion } = require('.');



const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;


// Core function to create user and insert wallet records
async function createUserCore(merchantId) {
	const chains = ["ETHEREUM_MAINNET", "POLYGON_MAINNET", "OPTIMISM_MAINNET"]; // According to Alex @ Bastion, spinning up a single wallet will spin up wallets for all chains, but i am specifying all networks for clairty
	// const chains = ["ETHEREUM_TESTNET", "POLYGON_AMOY", "OPTIMISM_SEPOLIA", "BASE_SEPOLIA"]; // FIXME: DEV ONLY
	const bodyObject = { id: merchantId, chains };
	const url = `${BASTION_URL}/v1/users`;
	const options = {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(bodyObject)
	};

	const response = await fetch(url, options);
	if (response.status !== 201) {
		const data = await response.json();
		throw new Error(`Failed to create user. Bastion response: ${JSON.stringify(data)} - ${response.statusText}`);
	}

	const data = await response.json();
	if (Array.isArray(data.addresses) && data.addresses.length > 0) {
		for (const addressEntry of data.addresses) {
			for (const chain of addressEntry.chains) {
				const { data: insertData, error } = await supabase
					.from('wallets')
					.insert([{
						merchant_id: merchantId,
						chain: chain,
						address: addressEntry.address
					}])
					.select();

				if (error) {
					throw new Error(`Supabase insert error: ${error}`);
				} else if (!(insertData && insertData.length > 0)) {
					logger.warn('Supabase insert resulted in no data or an empty response.');
				}

				// if chain is POLYGON_MAINNET, fund the wallet with 0.1 MATIC
				if (chain === 'POLYGON_MAINNET') {
					const { error: fundError } = await fundMaticPolygon(merchantId, addressEntry.address, '0.05');
					if (fundError) {
						logger.error(`Error funding wallet: ${fundError.message}`);
					}
				}
			}
		}
	} else {
		throw new Error('No addresses found in Bastion response');
	}
	// DEV ONLY: Fund the wallet with 0.05 MATIC without creating user on bastion
	// console.log('merchantId on create user core', merchantId);
	// const { error: fundError } = await fundMaticPolygon(merchantId, "0x1d0f45c4808A99398Ca7FbD57817f03DA1ACAcF6", '0.05'); // 500000 / 10e6 == 0.05 MATIC
	// if (fundError) {
	// 	logger.error(`Error funding wallet: ${fundError.message}`);
	// }

	return data;
}

exports.createUser = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.body;


	if (!merchantId) {
		return res.status(400).json({ error: 'merchantId is required' });
	}

	try {
		const data = await createUserCore(merchantId);
		res.status(201).json(data);
	} catch (error) {
		logger.error(`Something went wrong while creating user: ${JSON.stringify(error)}`);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.toString(),
				merchant_id: merchantId,
				endpoint: '/bastion/createUser'
			})
		res.status(500).json({ error: `Something went wrong: ${error}` });
	}
};

exports.getUser = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.query;

	console.log('merchantId', merchantId);

	const url = `${BASTION_URL}/v1/users/${merchantId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		if (response.status !== 200) {
			const errorMessage = `Failed to get user. Status: ${response.status}. Message: ${data.message || 'Unknown error'}`;
			throw new Error(errorMessage);
		}

		return res.status(200).json(data);
	} catch (error) {
		logger.error(`Something went wrong while retrieving user: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};

exports.getUserAction = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, requestId } = req.query;

	if (!merchantId || !requestId) {
		return res.status(400).json({ error: 'merchantId and requestId are required' });
	}

	const url = `${BASTION_URL}/v1/user-actions/${requestId}?userId=${merchantId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		if (response.status !== 200) {
			const errorMessage = `Failed to get user action. Status: ${response.status}. Message: ${data.message || 'Unknown error'}`;
			throw new Error(errorMessage);
		}

		return res.status(200).json(data);
	} catch (error) {
		logger.error(`Something went wrong while retrieving user action: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};


exports.submitKyc = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, firstName, middleName, lastName, dateOfBirth, ipAddress } = req.body;

	if (!dateOfBirth || !ipAddress || !merchantId) {
		return res.status(400).json({ error: 'merchantId, dateOfBirth and ipAddress are required' });
	}

	const bodyObject = {
		firstName: firstName,
		middleName: middleName,
		lastName: lastName,
		dateOfBirth: dateOfBirth,
		ipAddress: ipAddress
	};

	const url = `${BASTION_URL}/v1/users/${merchantId}/kyc`;
	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(bodyObject)
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();


		if (response.ok !== true) {
			const errorMessage = `Failed to submit KYC. Status: ${response.status}. Message: ${data.message || 'Unknown error'}`;
			throw new Error(errorMessage);
		}

		const complianceBodyObject = {
			bastion_kyc_response: data,
			bastion_customer_approved_at: null,
		};

		if (data.kycPassed === true && data.jurisdictionCheckPassed === true) {
			complianceBodyObject.bastion_customer_approved_at = new Date();
		}


		const { data: complianceUpdateData, error: complianceUpdateError } = await supabase
			.from('compliance')
			.update(complianceBodyObject)
			.match({ merchant_id: merchantId })
			.select();


		res.status(201).json({ bastionResponse: data, complianceRecord: complianceUpdateData });
	} catch (error) {
		logger.error(`Something went wrong while submitting KYC: ${JSON.stringify(error)}`);

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.toString(),
				merchant_id: merchantId,
				endpoint: '/bastion/submitKyc'
			})

		res.status(500).json({ error: `${error}` });
	}

};


exports.transferUsdc = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, destinationEmail, amount, chain } = req.body;

	if (!merchantId || !destinationEmail || !amount || !chain) {
		return res.status(400).json({ error: 'merchantId, destinationEmail, amount, and chain are required' });
	}

	const requestId = uuidv4();
	const contractAddress = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" // FIXME: contract address for USDC on Polygon Mainnet. In the future, we should set an env var or a json lookup file.

	let transactionRecord = {
		request_id: requestId,
		from_merchant_id: merchantId,
		destination_email: destinationEmail,
		amount: amount,
		chain: chain,
		transaction_status: 'Initiated',
		action_name: 'transfer',
		contract_address: contractAddress,
		status: 1
	};

	let toWalletAddress = '';
	let toWalletId = '';
	let recipientMerchantId = '';
	let fromWalletId = '';


	// Step 1: Check if the destinationEmail is already associated with a merchant account
	try {
		// Initial log to database
		let { error: transactionError } = await supabase
			.from('onchain_transactions')
			.insert([transactionRecord]);

		if (transactionError) throw transactionError;

		const { data: sourceMerchantData, error: sourceMerchantError } = await supabase
			.from('wallets')
			.select('*')
			.eq('merchant_id', merchantId)
			.eq('chain', chain);

		if (sourceMerchantError || !sourceMerchantData || sourceMerchantData.length === 0) {
			logger.error(`DB error while querying profiles table: ${recipientProfileError.message}`);
			throw new Error(`DB error while querying profiles table: ${recipientProfileError.message}`);
		}

		fromWalletId = sourceMerchantData[0].id;

		const { data: recipientProfileData, error: recipientProfileError } = await supabase
			.from('profiles')
			.select('merchant_id')
			.eq('email', destinationEmail);

		if (recipientProfileError) {
			logger.error(`DB error while querying profiles table: ${recipientProfileError.message}`);
			throw new Error(`DB error while querying profiles table: ${recipientProfileError.message}`);
		}

		if (!recipientProfileData || recipientProfileData.length === 0) {
			logger.info(`No profiles record found for ${destinationEmail}, creating new merchant`);

			// Sign in with OTP and create a new user, triggering on_auth_user_created which spins up the profiles and merchants table records
			const { error: newRecipientUserError } =
				await supabase.auth.signInWithOtp({
					email: destinationEmail,
					options: {
						shouldCreateUser: true,
					},
				});


			if (newRecipientUserError) {
				logger.error(`Error creating new user: ${newRecipientUserError.message}`);
				throw new Error(`Error creating new user: ${newRecipientUserError.message}`);
			}

			// Neccesary to poll for the new profile record to be created by the db trigger
			const waitForProfile = async () => {
				for (let i = 0; i < 10; i++) { // Try up to 10 times with a 5 second delay
					const { data: profileData, error: profileError } = await supabase
						.from('profiles')
						.select('merchant_id')
						.eq('email', destinationEmail);

					if (profileError) {
						logger.error(`DB error while polling profiles table: ${profileError.message}`);
						throw new Error(`DB error while polling profiles table: ${profileError.message}`);
					}

					if (profileData.length > 0) return profileData[0].merchant_id;
					await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before the next poll
				}

				throw new Error("Timeout waiting for profile creation.");
			};

			recipientMerchantId = await waitForProfile();

			// create the Bastion user and wallet and save the wallet records in supabase
			try {
				const createUserData = await createUserCore(recipientMerchantId);
				if (!createUserData || !createUserData.addresses || createUserData.addresses.length === 0) {
					throw new Error('Failed to create user and obtain wallet addresses');
				}

				const addressEntry = createUserData.addresses.find(addr => addr.chains.includes(chain));
				if (!addressEntry || !addressEntry.address) {
					throw new Error(`No address found for the specified chain: ${chain}`);
				}
				toWalletAddress = addressEntry.address;
				toWalletId = addressEntry.id;

			} catch (error) {
				logger.error(`Error in creating user or fetching addresses: ${error.message}`);
				return res.status(500).json({ error: `Error in creating user or fetching addresses: ${error.message}` });
			}

		} else {
			recipientMerchantId = recipientProfileData[0].merchant_id;

			const { data: walletData, error: walletError } = await supabase
				.from('wallets')
				.select('*')
				.eq('merchant_id', recipientMerchantId)
				.eq('chain', chain);

			if (walletError) {
				logger.error(`DB error while querying wallets table for destination wallet: ${walletError.message}`);
				throw new Error(`DB error while querying wallets table for destination wallet: ${walletError.message}`);
			}
			if (!walletData || walletData.length === 0) {
				logger.warn(`No wallets found for recipient merchant ID: ${recipientMerchantId}`);
				return res.status(404).json({ message: `No wallets found for recipient merchant ID: ${recipientMerchantId}` });
			}

			const toWallet = walletData.find(wallet => wallet.chain === chain);
			if (!toWallet) {
				logger.warn(`No wallet found for the specified chain: ${chain}`);
				return res.status(404).json({ message: `No wallet found for the specified chain: ${chain}` });
			}

			toWalletAddress = toWallet.address;
			toWalletId = toWallet.id;
		}
	} catch (error) {
		logger.error(`Error in processing request: ${error.message}`);
		return res.status(500).json({ error: `Error in processing request: ${error.message}` });
	}

	// Step 2: Initiate the on-chain transfer via Bastion /user-actions endpoint
	const bodyObject = {
		requestId: requestId,
		userId: merchantId,
		contractAddress: contractAddress,
		actionName: "transfer",
		chain: chain,
		actionParams: [
			{ name: "to", value: toWalletAddress },
			{ name: "value", value: amount }
		],
	};

	const url = `${BASTION_URL}/v1/user-actions`;
	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(bodyObject)
	};

	try {

		const response = await fetch(url, options);
		const data = await response.json();

		if (data.status === 'SUBMITTED' || `ACCEPTED` || `PENDING`) {
			const { data: updateData, error: updateError } = await supabase.from('onchain_transactions').update({
				bastion_response: data,
				transaction_hash: data.transactionHash,
				from_wallet_id: fromWalletId,
				to_wallet_id: toWalletId,
				to_merchant_id: recipientMerchantId,
			}).match({ request_id: requestId })
				.select();

			if (updateError) {
				logger.error(`Error updating transaction record: ${updateError.message}`);
				throw new Error(`Error updating transaction record: ${updateError.message}`);
			}
			return res.status(200).json({ message: 'Transfer submitted', bastionResponse: data, data: updateData });
		} else {
			throw new Error(`Failed to execute transfer. Status: ${response.status}. Message: ${JSON.stringify(data)}`);
		}
	} catch (error) {
		const { data: updateData, error: updateError } = await supabase.from('onchain_transactions').update({
			error_message: error.message,
			from_wallet_id: fromWalletId,
			to_wallet_id: toWalletId,
			to_merchant_id: recipientMerchantId,
		}).match({ request_id: requestId })
			.select();

		logger.error(`Error in transferUsdc: ${error.message}`);

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.toString(),
				merchant_id: merchantId,
				endpoint: '/bastion/transferUsdc'
			})
		return res.status(500).json({ message: "Error during transfer", error: error.message, data: updateData, status: error.status });
	}

};

exports.initiateUsdcWithdrawal = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, externalAccountId, amount } = req.body;

	if (!merchantId || !externalAccountId || !amount) {
		return res.status(400).json({ error: 'merchantId, externalAccountId, and amount are required' });
	}

	const requestId = uuidv4();
	const contractAddress = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // USDC contract on Polygon Mainnet
	const actionName = 'transfer';
	const chain = 'POLYGON_MAINNET';



	try {
		// get the bridge_liquidation_addresses record for the external account
		const { data: liquidationAddresses, error: liquidationAddressesError } = await supabase
			.from('bridge_liquidation_addresses')
			.select()
			.eq('external_account_id', externalAccountId);

		if (liquidationAddressesError || !liquidationAddresses || liquidationAddresses.length === 0) {
			return res.status(404).json({ error: 'Error getting a liquidation request with that externalAccountId' });
		}
		const toWalletAddress = liquidationAddresses[0].address;

		// get the wallets table record where the merchant_id == merchantId and chain == chain
		const { data: sourceWallets, error: sourceWalletsError } = await supabase
			.from('wallets')
			.select('address')
			.eq('merchant_id', merchantId)
			.eq('chain', chain);

		if (sourceWalletsError || !sourceWallets || sourceWallets.length === 0) {
			return res.status(404).json({ error: `No source wallet found for the merchant ${merchantId} on ${chain}` });
		}

		const fromWalletAddress = sourceWallets[0].address;

		let withdrawalRecord = {
			request_id: requestId,
			merchant_id: merchantId,
			external_account_id: externalAccountId,
			liquidation_address_id: liquidationAddresses[0].id,
			amount: amount,

			status: 1, // Initiated
			chain: chain,
			from_wallet_address: fromWalletAddress,
			action_name: actionName,
			contract_address: contractAddress,
		};

		// Log the initial transaction
		let { error: withdrawalError } = await supabase
			.from('withdrawals')
			.insert([withdrawalRecord]);

		if (withdrawalError) throw withdrawalError;

		// Step 2: Initiate the on-chain transfer via Bastion /user-actions endpoint
		const bodyObject = {
			requestId: requestId,
			userId: merchantId,
			contractAddress: contractAddress,
			actionName: actionName,
			chain: chain,
			actionParams: [
				{ name: "to", value: toWalletAddress },
				{ name: "value", value: amount.toString() }
			],
		};

		const url = `${BASTION_URL}/v1/user-actions`;
		const options = {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				Authorization: `Bearer ${BASTION_API_KEY}`
			},
			body: JSON.stringify(bodyObject)
		};

		const response = await fetch(url, options);
		const data = await response.json();

		if (data.status === 'SUBMITTED' || `ACCEPTED` || `PENDING`) {
			const { data: updateData, error: updateError } = await supabase
				.from('withdrawals')
				.update({
					bastion_response: data,
					bastion_withdraw_status: data.status,
					transaction_hash: data.transactionHash,
				})
				.match({ request_id: requestId });

			if (updateError) {
				throw new Error(`Error updating withdrawals record: ${updateError.message}`);
			}
			return res.status(200).json({ message: 'withdrawal submitted', bastionResponse: data, data: updateData });
		} else {
			throw new Error(`Failed to execute transfer. Status: ${response.status}. Message: ${JSON.stringify(data)}`);
		}
	} catch (error) {
		const { data: updateData, error: updateError } = await supabase
			.from('withdrawals')
			.update({
				bastion_response: error,
			})
			.match({ request_id: requestId });

		if (updateError) {
			throw new Error(`Error updating withdrawals record: ${updateError.message}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.toString(),
				merchant_id: merchantId,
				endpoint: '/bastion/initiateUsdcWithdrawal'
			})

		return res.status(500).json({ message: "Error during transfer", error: error.message, data: updateData, status: error.status });
	}
};

exports.updateOnchainTransactionStatus = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const bastionRequestBody = req.body;
	const requestId = req.body.data.requestId
	const requestStatus = req.body.data.status
	const merchantId = req.body.data.userId

	console.log("requestId", requestId, "requesststatus", requestStatus)
	try {
		// Check if the record exists in the onchain_transactions table
		const { data: transactionData, error: transactionError } = await supabase
			.from('onchain_transactions')
			.select('*')
			.eq('request_id', requestId)
		// .single();

		if (transactionError) {
			console.log('transaction error', transactionError)
			console.log(`No onchain_transactions record to update status for requestId == ${bastionRequestBody.data.requestId}`)
		}

		if (transactionData) {
			// If found, update the status in the onchain_transactions table
			const { data: updateData, error: updateError } = await supabase
				.from('onchain_transactions')
				.update({ bastion_transaction_status: requestStatus })
				.match({ request_id: requestId });

			if (updateError) {
				throw JSON.stringify(updateError);
			}

			return res.status(200).json({});
		} else {
			// If not found in onchain_transactions, check the withdrawals table
			const { data: withdrawalData, error: withdrawalError } = await supabase
				.from('withdrawals')
				.select('*')
				.eq('request_id', requestId)
				.single();

			if (withdrawalError) {
				console.log('withdrawlal error', withdrawalError)
				console.log(`No onchain_transactions record to update status for requestId == ${bastionRequestBody.data.requestId}`)
			}


			if (withdrawalData) {
				// If found, update the status in the withdrawals table
				const { data: updateWithdrawalData, error: updateWithdrawalError } = await supabase
					.from('withdrawals')
					.update({ bastion_withdraw_status: requestStatus })
					.match({ request_id: requestId });

				if (updateWithdrawalError) {
					throw updateWithdrawalError;
				}

				return res.status(200).json({});
			} else {
				console.log('got here')
				const { data: logData, error: logError } = await supabase
					.from('logs')
					.insert({
						log: `No record found to update status for requestId == ${requestId}`,
						merchant_id: merchantId,
						endpoint: '/updateOnchainTransactionStatus'
					});

				console.log("logData", logData)
				console.log("logError", logError)
				return res.status(404).json({ error: 'requestId not found ' });
			}
		}
	} catch (error) {
		console.error(`Error updating transaction status: ${error}`);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.toString(),
				merchant_id: merchantId,
				endpoint: '/updateOnchainTransactionStatus'
			});
		console.log("logData", logData)
		console.log("logError", logError)
		return res.status(500).json({ error: `Something went wrong` });
	}
};
