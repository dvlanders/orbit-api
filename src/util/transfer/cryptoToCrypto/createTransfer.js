const requiredFields = [
    "senderUserId", "amount", "requestId", "chain"
]

const acceptedFields = {
    "senderUserId": "string",
    "profileId": "string",
    "amount": "number",
    "requestId": "string",
    "recipientUserId": "string",
    "recipientAddress": "string",
    "chain": "string"
};

module.exports = {
    requiredFields,
    acceptedFields
}