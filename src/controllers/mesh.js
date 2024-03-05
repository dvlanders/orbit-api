// Assuming FrontApi is imported from '@front-finance/api'
const { FrontApi } = require('@front-finance/api');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
// const { merchantWalletLookup } = require('../util/mesh/mesh');
const { responseCodes, rs } = require('../util/Constants');
const { common } = require('../util/helper');

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL;
const MESH_CLIENT_ID = process.env.MESH_CLIENT_ID;
// const NEXT_PUBLIC_MESH_NETWORK_ADDRESS = process.env.NEXT_PUBLIC_MESH_NETWORK_ADDRESS;
// const NEXT_PUBLIC_SOL_DESTINATION_ADDRESS = process.env.NEXT_PUBLIC_SOL_DESTINATION_ADDRESS;
// const NEXT_PUBLIC_USERID = process.env.NEXT_PUBLIC_USERID;
// const NEXT_PUBLIC_SYMBOL = process.env.NEXT_PUBLIC_SYMBOL;

exports.createTransaction = async (req, res) => {

	const { authModal, amount } = req.query;
	const transactionId = uuidv4();
	const customerId = uuidv4();

	const merchantId = '4fb4ef7b-5576-431b-8d88-ad0b962be1df';

	// if (!merchantId) {
	// 	return res.status(400).json({ error: 'Merchant ID is required' });
	// }

	// const { merchantId } = req.params

	// use merchantWalletLookup function to look up the merchant's wallet address using the merchantId
	// const merchantWallet = await merchantWalletLookup(merchantId);

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}



	const bodyObject = {
		UserId: customerId,
	};

	if (authModal === 'false' || authModal === undefined) {
		bodyObject.transferOptions = {
			toAddresses: [
				{
					"NetworkId": "e3c7fdd8-b1fc-4e51-85ae-bb276e075611", // FIXME: build a util function that generates the toAddress array from supabase
					"Symbol": "ETH",
					"Address": "0x52d11761Dcc41C23091c856Ad2e36911745a5421" //FIXME: sam's eth address
				},
				// {
				// 	"NetworkId": "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
				// 	"Symbol": "USDC",
				// 	"Address": "0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6"
				// },
				// {
				// 	"NetworkId": "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
				// 	"Symbol": "USDT",
				// 	"Address": "0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6"
				// },
				// {
				// 	"NetworkId": "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12",
				// 	"Symbol": "MATIC",
				// 	"Address": "0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6"
				// }    
			],
			amountInFiat: amount,
			transactionId,
			// clientFee: 0.0, // Optional: Add a deposit fee if needed
			fundingOptions: { Enabled: true },
		};
	}

	const api = new FrontApi({
		baseURL: MESH_API_URL,
		headers: {
			'Content-Type': 'application/json',
			'X-Client-Id': MESH_CLIENT_ID,
			'X-Client-Secret': MESH_API_KEY,
		},
	});

	try {
		const getCatalogLink = await api.managedAccountAuthentication.v1LinktokenCreate(bodyObject);

		if (getCatalogLink.status !== 200) {
			const errorMessage = `Failed to retrieve or generate catalogLink. Status: ${getCatalogLink.status} - ${getCatalogLink.statusText}. Message: ${getCatalogLink.data.message}`;
			throw new Error(errorMessage);
		}

		const combinedPayload = {
			getCatalogLink: getCatalogLink.data,
			transferOptions: bodyObject,
		};

		return res.status(200).json(combinedPayload);
	} catch (error) {
		logger.error(`Something went wrong: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
}


