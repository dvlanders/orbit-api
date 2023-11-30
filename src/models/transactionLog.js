const dynamoose = require("dynamoose");

const transactionLogSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    merchantAddress: {
      type: [String, dynamoose.type.NULL],
      required: false,
      default: null,
    },
    customerAddress: {
      type: [String, dynamoose.type.NULL],
      required: false,
      default: null,
    },
    inwardCurrency: {
      type: String,
      required: true,
    },
    inwardBaseAmount: {
      type: Number,
      required: true,
    },
    inwardTotalAmount: {
      type: Number,
      required: false,
    },
    inwardTxnFees: {
      type: Number,
      required: false,
    },
    outwardCurrency: {
      type: String,
      required: true,
    },
    outwardBaseAmount: {
      type: Number,
      required: true,
    },
    outwardTotalAmount: {
      type: Number,
      required: false,
    },
    outwardTxnFees: {
      type: Number,
      required: false,
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
    withdrawStatus: {
      type: Boolean,
      default: false,
    },
    marketOrderStatus: {
      type: Boolean,
      default: false,
    },
    txId: {
      type: Number,
      required: false,
    },
    aTxId: {
      type: [Number, dynamoose.type.NULL],
      required: false,
      default: null,
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
    receiptTimestamp: {
      type: Number,
      required: false,
    },
    balanceStatus: {
      type: Boolean,
      default: false,
    },
    inwardAccountBalance: {
      type: Number,
      required: false,
    },
    outwardAccountBalance: {
      type: Number,
      required: false,
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

// Refund API
