// {
//     "merchantAddress":  "0xd56a859314712b189008a3373f39509d0bb08009",
//     "customerAddress": "0x4fF73f95656dc80a7CCe10d04ABCEB622fd03835",
//     "cryptoCurrency": "eth",
//     "cryptoCurrencyAmount": 0.00496316,
//     "fiatCurrency":"usd",
//     "fiatCurrencyAmount": 10,
//     "walletType": "MetaMask",
//     "email": "sultan.mobilefirst@gmail.com",
//     "name":"Sultan Khan"
// }
const dynamoose = require("dynamoose");

const transactionLogSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    merchantAddress: {
      type: String,
      required: true,
    },
    customerAddress: {
      type: String,
      required: true,
    },
    cryptoCurrency: {
      type: String,
      required: true,
    },
    cryptoCurrencyAmount: {
      type: Number,
      required: true,
    },
    fiatCurrency: {
      type: String,
      required: true,
    },
    fiatCurrencyAmount: {
      type: Number,
      required: true,
    },
    walletType: {
      type: String,
      required: true,
    },
    email: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    name: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    user_id: {
      type: String,
      required: true,
    },
    txnStatus: {
      type: Boolean,
      default: false,
    },
    txId: {
      type: Number,
      required: false,
    },
    aTxId: {
      type: Number,
      required: false,
    },
    orderId: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    clientOrderId: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    day: {
      type: String,
    },
    action: {
      type: String,
      required: false,
    },
    memo: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    amount: {
      type: Number,
      required: false,
    },
    price: {
      type: Number,
      required: false,
    },
    fees: {
      // this fees is the monetization fee
      type: Number,
      required: false,
    },
    status: {
      type: String,
      required: false,
    },
    holdExpires: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    txHash: {
      type: String,
      required: false,
    },
    algoName: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    algoId: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    accountBalance: {
      type: Number,
      required: false,
    },
    accountTransferFee: {
      type: Number,
      required: false,
    },
    txnGasFee: {
      type: Number,
      required: false,
    },
    symbol: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    idempotencyId: {
      type: [String, dynamoose.type.NULL],
      required: false,
    },
    timestamp: {
      type: Number,
      required: false,
    },
    balanceStatus: {
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
let TransactionLog = dynamoose.model("transactionLog", transactionLogSchema);
module.exports = TransactionLog;
