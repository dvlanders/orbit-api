const dynamoose = require("dynamoose");

const currencySchema = new dynamoose.Schema(
  {
    id: String,
    symbol: String,
    name: String,
    is_fiat: Boolean,
    is_lending_enabled: Boolean,
    can_deposit: Boolean,
    can_withdraw: Boolean,
    min_withdrawal: Number,
    confirmations_needed: {
      type: [Number, dynamoose.type.NULL],
    },
    precision: Number,
    ascii_sign: String,
    contract_address: {
      type: [String, dynamoose.type.NULL],
    },
    custody_enabled: Boolean,
    trading_enabled: Boolean,
    primary_network: {
      type: [String, dynamoose.type.NULL],
    },
    code: String,
    currency: String,
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
let Currency = dynamoose.model("currency", currencySchema);
module.exports = Currency;
