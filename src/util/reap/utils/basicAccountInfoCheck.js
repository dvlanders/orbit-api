const basicReapAccountInfoCheck = (config) => {
    if (config.network == "fps"){
        if (config.accountIdentifierStandard != "fps_id"){
            return false
        }
    }

    if (config.network == "chats"){
        if (config.accountIdentifierStandard == "fps_id"){
            return false
        }
    }

    return true
}

module.exports = {
    basicReapAccountInfoCheck
}