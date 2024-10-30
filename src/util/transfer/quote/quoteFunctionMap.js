const { getQuoteFromYellowcard } = require("./yellowcardQuote");

const quoteFunctionMap = {
    "YELLOWCARD": {
        getQuote: getQuoteFromYellowcard
    }
}

module.exports = {
    quoteFunctionMap
}