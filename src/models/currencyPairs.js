const dynamoose = require("dynamoose");

const currencyPairSchema = new dynamoose.Schema(
  {
    id: String,
    formattedSymbol: String,
    symbol: String,
    base: String,
    quote: String,
  },
  {
    timestamps: {
      createdAt: "createDate",
      updatedAt: null, // updatedAt will not be stored as part of the timestamp
    },
  }
);
let CurrencyPair = dynamoose.model("currencyPair", currencyPairSchema);
module.exports = CurrencyPair;
