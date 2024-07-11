const { createCircleDepositAddresses } = require('./src/util/circle/endpoint/createCircleDepositAddress');

// Set environment variables for testing if not set globally
process.env.CIRCLE_URL = 'https://api.your-circle-environment.com';
process.env.CIRCLE_API_KEY = 'your-api-key';

// Example user ID and currency
const userId = 'example-user-id';
const currency = 'USD';

createCircleDepositAddresses(userId, currency)
	.then((result) => {
		console.log('Result:', result);
	})
	.catch((error) => {
		console.error('Error:', error);
	});
