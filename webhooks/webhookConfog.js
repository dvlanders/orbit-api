const webhookEventActionType = {
    UPDATE: "UPDATE"
}

const webhookEventType = {
    "USER.STATUS": "USER.STATUS",
    "TRANSFER.CRYPTO_TO_CRYPTO": "TRANSFER.CRYPTO_TO_CRYPTO",
    "TRANSFER.CRYPTO_TO_FIAT": "TRANSFER.CRYPTO_TO_FIAT",
    "TRANSFER.FIAT_TO_CRYPTO": "TRANSFER.FIAT_TO_CRYPTO"
}


module.exports = {
    webhookEventActionType,
    webhookEventType
}