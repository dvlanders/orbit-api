const toUnitsString = (amount, decimal) => {
    return BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimal))).toString()
}

module.exports = {
    toUnitsString
}