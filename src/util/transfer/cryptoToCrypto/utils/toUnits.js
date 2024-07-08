const toUnitsString = (amount, decimal) => {
    return BigInt(parseFloat(amount) * Math.pow(10, decimal)).toString()
}

module.exports = {
    toUnitsString
}