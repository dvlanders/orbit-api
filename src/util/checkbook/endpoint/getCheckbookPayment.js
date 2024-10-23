const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const getCheckbookPayment = async (paymentId, apiKey, apiSecret) => {

    const url = `${CHECKBOOK_URL}/check/${paymentId}`;
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `${apiKey}:${apiSecret}`, // use the api key of the checkbook user that received the payment
        },
    };

	const response = await fetch(url, options);
	const responseBody = await response.json();
	return {response, responseBody};
}

module.exports = {
	getCheckbookPayment
}