function safeStringToFloat(str) {
    // Trim whitespace from the string and replace any commas with periods
    const cleanedStr = str.trim()
  
    // Attempt to parse the string to a float
    const floatVal = parseFloat(cleanedStr);
  
    // Check if the result is a valid number
    if (isNaN(floatVal)) throw new Error("Number string provided is invalid")
    return floatVal
  }

function safeSum(values) {
  return values.reduce((sum, value) => {
    const num = parseFloat(value); 
    if (!isNaN(num)) {            
      return sum + num;
    }else{
      throw new Error("Number string provided is invalid")
    }
    return sum;
  }, 0);
}

function safeToNumberString(input, toFixed = 2) {
  // Check if the input is a number or a string
  if (typeof input === 'number') {
    // If it's a number, convert it to a string with 2 decimal places
    return input.toFixed(toFixed);
  } else if (typeof input === 'string') {
    // Trim whitespace from the string
    const cleanedStr = input.trim();

    // Attempt to parse the string to a float
    const floatVal = parseFloat(cleanedStr);

    // Check if the result is a valid number
    if (isNaN(floatVal)) throw new Error("Number string provided is invalid");

    // Convert the float to a string with 2 decimal places
    return floatVal.toFixed(toFixed);
  } else {
    throw new Error("Input must be a string or a number");
  }
}



module.exports = {
    safeStringToFloat,
    safeSum,
    safeToNumberString
}