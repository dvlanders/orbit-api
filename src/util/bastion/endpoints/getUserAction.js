const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const getUserActions = async(requestId, userId) => {
    const url = `${BASTION_URL}/v1/user-actions/${requestId}?userId=${userId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

    const response = await fetch(url, options);
    return response
}

module.exports = {
	getUserActions
}