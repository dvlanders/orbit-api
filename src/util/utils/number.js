function safeStringToFloat(str) {
    // Trim whitespace from the string and replace any commas with periods
    const cleanedStr = str.trim()
  
    // Attempt to parse the string to a float
    const floatVal = parseFloat(cleanedStr);
  
    // Check if the result is a valid number
    if (isNaN(floatVal)) throw new Error("Number string provided is invalid")
    return floatVal
  }

module.exports = {
    safeStringToFloat
}