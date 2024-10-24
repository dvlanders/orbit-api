const { Chain } = require("../../common/blockchain");
const { BastionSupportedEVMChainSandbox, BastionSupportedEVMChainProd } = require("../utils/utils");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;
const chains = process.env.NODE_ENV == "development"? BastionSupportedEVMChainSandbox : BastionSupportedEVMChainProd

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

	const response = await fetchWithLogging(url, options, "BASTION");
	return response
}

module.exports = {
    createUser
}