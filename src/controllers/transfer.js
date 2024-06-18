const supabase = require("../util/supabaseClient");
const { fieldsValidation, isUUID } = require("../util/common/fieldsValidation");
const { requiredFields, acceptedFields } = require("../util/transfer/cryptoToCrypto/utils/createTransfer");
const createLog = require("../util/logger/supabaseLogger");
const { hifiSupportedChain, currencyDecimal } = require("../util/common/blockchain");
const { isBastionKycPassed, isBridgeKycPassed } = require("../util/common/privilegeCheck");
const { fetchRequestInfortmaion } = require("../util/transfer/cryptoToCrypto/utils/fetchRequestInformation");
const { transfer } = require("../util/transfer/cryptoToCrypto/main/transfer");
const { fetchUserWalletInformation } = require("../util/transfer/cryptoToCrypto/utils/fetchUserWalletInformation");
const { getRequestRecord } = require("../util/transfer/cryptoToCrypto/main/getRequestRecord");
const fetch = require('node-fetch');
// const { fieldsValidation } = require("../util/common/fieldsValidation");

const { supabaseCall } = require('../util/supabaseWithRetry');
const { v4 } = require('uuid');

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

exports.createCryptoToCryptoTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// should gather senderUserId, profileId, amount, requestId, recipientUserId, recipientAddress, chain
	// const profileId = req.profile.id
	const profileId = "7cdf31e1-eb47-4b43-82f7-e368e3f6197b"
	const fields = req.body
	const currency = "usdc" // currency should only be usdc for now
	fields.currency = currency
	const { senderUserId, amount, requestId, recipientUserId, recipientAddress, chain } = fields
	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)

		// check if required fileds provided
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })
		}
		if (!profileId) {
			createLog("transfer/createCryptoToCryptoTransfer", senderUserId, "No profile id found")
			return res.status(500).json({ error: "Unexpected error happened" })
		}

		// check if provide either recipientUserId or recipientAddress
		if (!recipientUserId && !recipientAddress) return res.status(400).json({ error: `Should provide either recipientUserId or recipientAddress` })
		if (recipientUserId && recipientAddress) return res.status(400).json({ error: `Should only provide either recipientUserId or recipientAddress` })
		// check if chain is supported
		if (!hifiSupportedChain.includes(chain)) return res.status(400).json({ error: `Chain ${chain} is not supported` })
		// fetch sender wallet address information
		if (recipientUserId) {
			const senderBastionInformation = await fetchUserWalletInformation(senderUserId, chain)
			if (!senderBastionInformation) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user wallet record not found)` })
		}
		// check privilege
		if (!(await isBastionKycPassed(senderUserId)) || !(await isBridgeKycPassed(senderUserId))) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user status invalid)` })
		// check recipient wallet address if using recipientUserId
		if (recipientUserId) {
			const recipientWalletInformation = await fetchUserWalletInformation(recipientUserId, chain)
			if (!recipientWalletInformation) return res.status(400).json({ error: `recipient wallet not found` })
			fields.recipientAddress = recipientWalletInformation.address
		}
		// check is uuid valid
		if (!isUUID(requestId)) return res.status(400).json({ error: "requestId is not a valid uuid" })
		// check is request_id exist
		if (await fetchRequestInfortmaion(requestId)) return res.status(400).json({ error: `Request for requestId: ${requestId} is already exist, use get endpoint to get the status instead` })
		// peform transfer
		const receipt = await transfer(fields)

		return res.status(200).json(receipt)
	} catch (error) {
		createLog("transfer/create", fields.senderUserId, error.message, error)
		return res.status(500).json({ error: `Unexpected error happened` })
	}
}

exports.getCryptoToCryptoTransfer = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { requestId } = req.query

	try {
		// check if requestRecord exist
		const requestRecord = await fetchRequestInfortmaion(requestId)
		if (!requestRecord) return res.status(404).json({ error: "request not found" })
		// fetch up to date record
		const receipt = await getRequestRecord(requestRecord)
		return res.status(200).json(receipt)

	} catch (error) {
		console.error(error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}





}

exports.transferUsdcFromWalletToBankAccount = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId } = req.query;
	const { destinationAccountId, amount } = req.body;


	console.log('userId', userId, 'destinationAccountId', destinationAccountId, 'amount', amount);
	if (!userId || !destinationAccountId || !amount) {
		return res.status(400).json({ error: 'userId destinationAccountId, and amount are required' });
	}

	const actionName = 'transfer';

	// PROD
	// const contractAddress = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // USDC contract on Polygon Mainnet

	// DEV
	const contractAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // USDC contract on Ethereum Testnet

	// PROD
	// const chain = 'POLYGON_MAINNET';

	// DEV
	const chain = 'ETHEREUM_TESTNET';

	// get the external account record
	const { data: liquidationAddressData, error: liquidationAddressError } = await supabase
		.from('bridge_liquidation_addresses')
		.select('id, address')
		.eq('external_account_id', destinationAccountId)
		.maybeSingle();

	if (liquidationAddressError) {
		return res.status(400).json({ error: 'An error occurred while fetching the transaction address associated with the account' });
	}

	// get the wallet record
	const { data: walletData, error: walletError } = await supabase
		.from('bastion_wallets')
		.select('address')
		.eq('user_id', userId)
		.maybeSingle();

	if (walletError) {
		return res.status(400).json({ error: 'An error occurred while fetching the wallet record' });
	}


	// execute the transfer using bastion user actions
	try {
		const requestId = v4();

		//insert the initial record
		const { data: initialBastionTransfersInsertData, error: initialBastionTransfersInsertError } = await supabase.from('offramp_transactions').insert({
			id: requestId,
			user_id: userId,
			amount: amount,
			chain: chain,
			from_wallet_address: walletData.address,
			to_wallet_address: liquidationAddressData.address,
			to_bridge_liquidation_address_id: liquidationAddressData.id,
			to_bridge_external_account_id: destinationAccountId,
			transaction_status: 'NOT_INITIATED',
			contract_address: contractAddress,
			action_name: actionName,
		})
			.select();

		if (initialBastionTransfersInsertError) {
			console.error('initialBastionTransfersInsertError', initialBastionTransfersInsertError);
			return res.status(500).json({ error: 'An error occurred while inserting the transfer record' });
		}

		// multiply the amount by 10^6 to convert it to the smallest unit of the token
		const toUnitsString = (amount, decimal) => {
			return BigInt(amount * Math.pow(10, decimal)).toString()
		}

		const amountInSmallestUnit = toUnitsString(amount, 6);

		const bodyObject = {
			requestId: requestId,
			userId: userId,
			contractAddress: contractAddress,
			actionName: "transfer",
			chain: chain,
			actionParams: [
				// { name: "to", value: liquidationAddressData.address },
				{ name: "to", value: '0xeDEa02367558FBF0387dD6c17A85A6b57A8Ce0Ad' },
				{ name: "value", value: amountInSmallestUnit }
			],
		};

		console.log('bodyObject', bodyObject)

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

		console.log('data', data)

		if (!response.ok) {
			throw new Error(`Failed to execute transfer. ${JSON.stringify(data)}`);
		}

		if (data.status === 'FAILED') {
			const { error: updateError } = await supabase.from('offramp_transactions').update({
				bastion_response: data,
				transaction_hash: data.transactionHash,
				bastion_transaction_status: data.status,
				transaction_status: "FAILED_ONCHAIN",
			}).match({ id: requestId })

			if (updateError) {
				return res.status(500).json({ error: 'An error occurred while updating the transaction data.' });
			}

			return res.status(400).json({
				error: 'Your transfer request failed. It is likely this wallet does not have sufficient USDC. If this problem persists despite sufficient funding, please reach out to developers@hifibridge.com'
			})
		}

		const { error: updateError } = await supabase.from('offramp_transactions').update({
			bastion_response: data,
			transaction_hash: data.transactionHash,
			bastion_transaction_status: data.status,
		}).match({ id: requestId })



		if (updateError) {
			return res.status(500).json({ error: 'Your transfer request was submitted. However, an error occurred while updating the transaction data.' });
		}

		return res.status(200).json({
			message: 'Your transfer request was submitted successfully',
			data: {
				id: requestId,
				createdAt: initialBastionTransfersInsertData.created_at,
				transactionHash: data.transactionHash,
				bastion_transaction_status: data.status,
			}
		});

	} catch (error) {
		return res.status(500).json({ error: 'An error occurred while executing the transfer' });
	}




}

