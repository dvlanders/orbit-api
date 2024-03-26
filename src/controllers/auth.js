const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
const { validate: uuidValidate } = require('uuid');

exports.generatePageToken = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const requiredFields = ['transactionId', 'merchantId', 'customerId', 'amountInFiat', 'itemBasket'];
	const missingField = requiredFields.find(field => req.body[field] === undefined);
	if (missingField) {
		return res.status(400).json({ error: `${missingField} is required` });
	}

	const { transactionId, merchantId, customerId, amountInFiat, salesTax, itemBasket } = req.body;

	const isMerchantUuidValid = uuidValidate(merchantId);
	if (!isMerchantUuidValid) {
		return res.status(400).json({ error: 'merchantId must be a valid UUID' });
	}

	const isTransactionIdString = typeof transactionId === 'string';
	const isCustomerIdString = typeof customerId === 'string';
	if (!isTransactionIdString || !isCustomerIdString) {
		return res.status(400).json({ error: 'transactionId and customerId must be strings' });
	}

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

	const internalTransactionId = uuidv4();
	const internalCustomerId = uuidv4();


	try {
		// Insert the customer record
		const customerParams = {
			id: internalCustomerId,
			merchant_customer_id: customerId,
			merchant_id: merchantId,
		};

		const { data: customerData, error: customerError } = await supabase
			.from('customers')
			.insert([customerParams])
			.single();

		if (customerError) {
			throw new Error(customerError.message);
		}

		// Insert the transaction record, linking to the newly created customer
		const transactionParams = {
			id: internalTransactionId,
			merchant_id: merchantId,
			merchant_transaction_id: transactionId,
			customer_id: internalCustomerId,
			amount_fiat: amountInFiat,
			...(salesTax && { sales_tax: salesTax }),
		};

		const checkoutPageLink = `${process.env.FRONTEND_URL}/?transactionId=${internalTransactionId}`;
		transactionParams.checkout_page_link = checkoutPageLink;

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

		return res.status(200
		).json({ checkoutPageLink });
	} catch (error) {
		logger.error(`Something went wrong: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
}
