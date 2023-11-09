const dynamoose = require("dynamoose");

const currencyPairSchema = new dynamoose.Schema(
  {
    id: String,
    formattedSymbol: {
      type: [String, dynamoose.type.NULL],
    },
    symbol: String,
    base: String,
    quote: String,
    isActive: {
      type: Boolean,
      default: false,
    },
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
