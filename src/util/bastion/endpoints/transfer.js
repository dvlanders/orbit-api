const { currencyContractAddress } = require("../../common/blockchain");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

exports.transfer = async(requestRecord) => {

    const bodyObject = {
		requestId: requestRecord.requestId,
		userId: requestRecord.senderUserId,
		contractAddress: requestRecord.contractAddress,
		actionName: "transfer",
		chain: requestRecord.chain,
		actionParams: [
			{ name: "to", value: requestRecord.recipientAddress },
			{ name: "value", value: requestRecord.unitsAmount }
		],
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

    const response = await fetch(url, options);
    return response
}