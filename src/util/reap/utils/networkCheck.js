const reapNetwrokMap = {
    "usd": ["chats", "swift"],
    "hkd": ["fps"],
}

const networkCheck = (network, currency) => {
    return reapNetwrokMap[currency].includes(network)
}

module.exports = {
    networkCheck
}