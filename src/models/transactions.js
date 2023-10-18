const dynamoose = require("dynamoose");
const { STRING } = require("sequelize");

const transactionSchema = new dynamoose.Schema(
  {
    id: String,
    atxid: Number,
    order_id: String ,
    client_order_id: String,
    day: String,
    action: String,
    currency: String,
    memo: String,
    amount: Number,
    net_proceeds: Number,
    price: Number,
    fees: Number,
    status: String,
    hold_expires: String,
    tx_hash: String ,
    algo_name: String,
    algo_id: String ,
    account_balance: Number,
    AccountTransferFee: Number,
    description: String ,
    wallet_display_id: String,
    added_by_user_email: String,
    symbol: String,
    IdempotencyId: String,
    timestamp: Number
  },
  {
    timestamps: {
      createdAt: "createDate",
      updatedAt: null, // updatedAt will not be stored as part of the timestamp
    },
  }
);
let transactions = dynamoose.model("transaction", transactionSchema);
module.exports = transactions;
