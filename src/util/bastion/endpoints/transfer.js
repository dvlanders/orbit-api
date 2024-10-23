const { currencyContractAddress } = require("../../common/blockchain");
const { erc20Transfer } = require("../utils/erc20FunctionMap");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

exports.transfer = async(id, requestRecord) => {

    const bodyObject = {
		requestId: id,
		userId: requestRecord.senderUserId,
		contractAddress: requestRecord.contractAddress,
		actionName: "transfer",
		chain: requestRecord.chain,
		actionParams: erc20Transfer(requestRecord.currency, requestRecord.chain, requestRecord.recipientAddress, requestRecord.unitsAmount)
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

    const response = await fetchWithLogging(url, options);
    return response
}