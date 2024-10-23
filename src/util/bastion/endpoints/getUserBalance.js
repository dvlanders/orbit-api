const { fetchWithLogging } = require('../../logger/fetchLogger');

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

exports.getUserBalance = async(userId, chain) => {
    const url = `${BASTION_URL}/v1/users/${userId}/balances?chain=${chain}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

    const response = await fetchWithLogging(url, options);
    return response
}
