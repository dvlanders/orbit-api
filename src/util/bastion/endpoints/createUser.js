const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

async function createUser(userId) {
	const url = `${BASTION_URL}/v1/users`;
	const bodyObject = { id: userId, chains: ["ETHEREUM_TESTNET"] };
    // const bodyObject = { id: userId, chains: ["ETHEREUM_MAINNET", "POLYGON_MAINNET", "OPTIMISM_MAINNET", "BASE_MAINNET"] };
	const options = {
		method: "POST",
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(bodyObject),
	};

	const response = await fetch(url, options);
	return response
}

module.exports = {
    createUser
}