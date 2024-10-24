const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const transferBaseAsset = async(requestId, bastionUserId, chain, currencySymbol, amount, recipientAddress) => {
    const bodyObject = {
        requestId: requestId,
        userId: bastionUserId,
        chain: chain,
        currencySymbol,
        amount: amount,
        recipientAddress: recipientAddress,
    };

    const url = `${BASTION_URL}/v1/crypto/transfers`;
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${BASTION_API_KEY}`
        },
        body: JSON.stringify(bodyObject)
    };
    const response = await fetch(url, options)
    return response
}

module.exports = transferBaseAsset