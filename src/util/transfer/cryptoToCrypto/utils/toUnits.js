const toUnitsString = (amount, decimal) => {
    return BigInt(amount * Math.pow(10, decimal)).toString()
}

module.exports = {
    toUnitsString
}