const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
// const { fieldsValidation } = require("../util/common/fieldsValidation");
const createAndFundBastionUser = require('../util/bastion/fundMaticPolygon');
const createLog = require('../util/logger/supabaseLogger');
const { createBridgeExternalAccount } = require('../util/bridge/endpoint/createBridgeExternalAccount')
const { createCheckbookBankAccount } = require('../util/checkbook/endpoint/createCheckbookBankAccount')
const { getBridgeExternalAccount } = require('../util/bridge/endpoint/getBridgeExternalAccount');
const { supabaseCall } = require('../util/supabaseWithRetry');
const { v4 } = require('uuid');


const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

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
		const { data: initialBastionTransfersInsertData, error: initialBastionTransfersInsertError } = await supabase.from('bastion_transfers').insert({
			id: requestId,
			from_user_id: userId,
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


		const { error: updateError } = await supabase.from('bastion_transfers').update({
			bastion_response: data,
			transaction_hash: data.transactionHash,
			transaction_status: data.status,
		}).match({ id: requestId })



		if (updateError) {
			return res.status(500).json({ error: 'Your transfer request was submitted. However, an error occurred while updating the transfer record' });
		}

		return res.status(200).json({
			message: 'Your transfer request was submitted successfully',
			data: {
				id: requestId,
				createdAt: initialBastionTransfersInsertData.created_at,
				transactionHash: data.transactionHash,
				status: data.status,
				amount: amount,
			}
		});

	} catch (error) {
		return res.status(500).json({ error: 'An error occurred while executing the transfer' });
	}




}
