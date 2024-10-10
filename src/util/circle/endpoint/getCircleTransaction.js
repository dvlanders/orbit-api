const { CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;

const getCircleTransaction = async (transactionId) => {

	const url = `${CIRCLE_WALLET_URL}/v1/w3s/transactions/${transactionId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${CIRCLE_WALLET_API_KEY}`
		}
	};

    const response = await fetch(url, options);
    return response;
}


module.exports = {
    getCircleTransaction
}