const { Chain } = require("../../common/blockchain");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;
console.log("env", process.env.NODE_ENV)
const chains = process.env.NODE_ENV == "development"? [Chain.POLYGON_AMOY] : [Chain.POLYGON_MAINNET, Chain.ETHEREUM_MAINNET, Chain.OPTIMISM_MAINNET]

async function createUser(userId) {
	const url = `${BASTION_URL}/v1/users`;
    const bodyObject = { id: userId, chains};
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