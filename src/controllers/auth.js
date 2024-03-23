const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
const { validate: uuidValidate } = require('uuid');


// The merchant's backend should hit this endpoint to generate a link to our hosted checkout page
exports.generatePageToken = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// Basic presence checks
	const requiredFields = ['transactionId', 'merchantId', 'customerId', 'amountInFiat', 'itemBasket'];
	const missingField = requiredFields.find(field => req.body[field] === undefined);
	if (missingField) {
		return res.status(400).json({ error: `${missingField} is required` });
	}

	// Format validation
	// salesTax, itemBasket are optional
	// The transactionId must be a string, merchantId and customerId must be valid UUIDs, amountInFiat and salesTax (optional) must be numbers, and itemBasket should be an array of objects where each object includes a productName and description as strings, and price and quantity as numbers.
	const { transactionId, merchantId, customerId, amountInFiat, salesTax, itemBasket } = req.body;

	// Validate merchantId as UUID
	const isMerchantUuidValid = uuidValidate(merchantId);
	if (!isMerchantUuidValid) {
		return res.status(400).json({ error: 'merchantId must be a valid UUID' });
	}

	// Validate transactionId and customerId as strings
	const isTransactionIdString = typeof transactionId === 'string';
	const isCustomerIdString = typeof customerId === 'string';
	if (!isTransactionIdString || !isCustomerIdString) {
		return res.status(400).json({ error: 'transactionId and customerId must be strings' });
	}

	// Validate amountInFiat as number and salesTax as number if it's defined
	const isNumber = typeof amountInFiat === 'number' && (salesTax === undefined || typeof salesTax === 'number');
	if (!isNumber) {
		return res.status(400).json({ error: 'amountInFiat and salesTax must be numbers' });
	}

	const isValidItemBasket = Array.isArray(itemBasket) && itemBasket.every(item =>
		typeof item === 'object' &&
		typeof item.productName === 'string' &&
		typeof item.description === 'string' &&
		typeof item.price === 'number' &&
		typeof item.quantity === 'number');

	if (!isValidItemBasket) {
		return res.status(400).json({ error: 'itemBasket format is invalid' });
	}

	// we use a separate internal transaction ID as the primary key in transactions table for internal tracking bc the merchant's transaction id could be anything
	const internalTransactionId = uuidv4();

	const transactionParams = {
		id: internalTransactionId,
		merchant_id: merchantId,
		merchant_transaction_id: transactionId,
		customer_id: customerId,
		amount_fiat: amountInFiat,
		...(salesTax && { sales_tax: salesTax }),
	};

	const checkoutPageLink = `${process.env.FRONTEND_URL}/?transactionId=${internalTransactionId}` //FIXXME: for prod, change to actual domain

	transactionParams.checkout_page_link = checkoutPageLink;

	try {
		const { error: transactionError } = await supabase
			.from('transactions')
			.insert([transactionParams]);

		if (transactionError) {
			throw new Error(transactionError.message);
		}

		if (itemBasket && itemBasket.length) {
			const itemRecords = itemBasket.map(item => ({
				product_name: item.productName,
				description: item.description,
				price: item.price,
				quantity: item.quantity,
				transaction_id: internalTransactionId,
			}));

			const { error: itemsError } = await supabase
				.from('items')
				.insert(itemRecords);

			if (itemsError) {
				throw new Error(itemsError.message);
			}
		}

		return res.status(200).json({ checkoutPageLink });
	} catch (error) {
		logger.error(`Something went wrong: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
}
