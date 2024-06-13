const requiredFields = [
    "senderUserId", "amount", "requestId", "chain", "currency"
]

const acceptedFields = {
    "senderUserId": "string",
    "profileId": "string",
    "amount": "number",
    "requestId": "string",
    "recipientUserId": "string",
    "recipientAddress": "string",
    "chain": "string",
    "currency": "string"
};

module.exports = {
    requiredFields,
    acceptedFields
}