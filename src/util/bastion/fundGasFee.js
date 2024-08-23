const fetch = require('node-fetch');
const { v4: uuidv4 } = require("uuid");
const supabase = require('../supabaseClient');
const { Chain } = require('../common/blockchain');
const createLog = require('../logger/supabaseLogger');
const { getBastionWallet } = require('./utils/getBastionWallet');

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;
const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df' // this is the user id in bastion prod that has been prefunded with ETH to serve as gas station wallet
const gasStationWalletAddress = '0x9Bf9Bd42Eb098C3fB74F37d2A3BA8141B5785a5f'

const currencySymbolMap = {
	"ETHEREUM_MAINNET": "ETH",
	"POLYGON_MAINNET": "MATIC"
}

async function fundUserGasFee(userId, amount, chain, type = "INDIVIDUAL") {
	try {
		// get user wallet
		const {walletAddress} = await getBastionWallet(userId, chain, type)
		if (!walletAddress) throw new Error(`No user wallet found`)
		
		const currencySymbol = currencySymbolMap[chain]
		if (!currencySymbol) throw new Error(`No currencySymbol found for chain: ${chain}`)
			
		const requestId = uuidv4();
		const bodyObject = {
			requestId: requestId,
			userId: gasStation,
			chain: chain,
			currencySymbol,
			amount: amount,
			recipientAddress: walletAddress,

		};

		const url = `${BASTION_URL}/v1/crypto/transfers`;
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
		if (!response.ok) {
			throw JSON.stringify(data);
		}

		const { data: gasData, error: gasError } = await supabase
			.from('bastion_gas_station_transactions')
			.insert({
				request_id: requestId,
				destination_user_id: userId,
				source_wallet_address: gasStationWalletAddress,
				destination_wallet_address: walletAddress,
				amount: amount,
				chain: chain,
				bastion_response: data,
				transaction_hash: data.transactionHash,
				status: data.status,
				gas_sponsor_bastion_user_id: gasStation
			});

		if (gasError) {
			console.error("Error inserting gas transaction into database:", gasError);
			throw gasError;
		}

		return data;

	} catch (error) {
		await createLog("bastion/fundUserGasFee", userId, error.message, error)
		return null
		// throw JSON.stringify(error);
	}
}

module.exports = fundUserGasFee;
