const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');

// This endpoint is called by the merchant's server to generate a HiFi Bridge redirect link which contains an auth token which our hosted page wil then use to get the transaction details
exports.generatePageToken = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const merchantId = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'; // Example merchant ID

	const itemBasket = [
		{ productName: 'Trail Runner X', description: "High-traction trail running shoes with waterproof upper.", price: 120.00, quantity: 1 },
		{ productName: 'Urban Comfort', description: "Sleek and comfortable shoes perfect for daily wear in the city.", price: 85.50, quantity: 2 },
		{ productName: 'Gym Shark 2.0', description: "Lightweight and breathable gym shoes with extra cushioning.", price: 99.99, quantity: 1 }
	];

	const transactionId = uuidv4();
	const transactionFee = 0.01; // FIXME: Replace with the actual transaction fee

	const allParams = {
		itemBasket,
		transactionId,
		merchantId,
		transactionFee
	};

	// make a call to supabase to store the transaction details
	// 

	const serializedParams = encodeURIComponent(JSON.stringify(allParams));

	// FIXME: Replace with the actual HiFi Bridge URL
	// const hifiLink = `https://checkout.hifibridge.com?params=${serializedParams}`;
	const hifiLink = `http://localhost:3000/?params=${serializedParams}`;

	try {
		return res.status(200).json({ hifiLink });
	} catch (error) {
		logger.error(`Something went wrong: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
}


