const { currencyContractAddress } = require("../../common/blockchain");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

exports.submitUserAction = async(params) => {

    const bodyObject = {
		requestId: params.requestId,
		userId: params.userId,
		contractAddress: params.contractAddress,
		actionName: params.actionName,
		chain: params.chain,
		actionParams: params.actionParams
	};

    const url = `${BASTION_URL}/v1/user-actions`;
	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(bodyObject)
	};

    const response = await fetchWithLogging(url, options, "BASTION");
    return response
}