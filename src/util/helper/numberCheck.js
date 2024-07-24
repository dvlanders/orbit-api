function isNumberOrNumericString(value) {
    // Check if the value is a number or if it can be converted to a valid number
    return !isNaN(value) && !isNaN(parseFloat(value)) && /^[0-9]+(\.[0-9]+)?$/.test(value);
  }

module.exports = {
    isNumberOrNumericString
}