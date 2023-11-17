const dynamoose = require("dynamoose");

const balanceSchema = new dynamoose.Schema(
  {
    id: String,
    currentlyWayToBankAccount: {
      type: Number,
      required: true,
    },
    estimateFuturePayouts: {
      type: Number,
      required: true,
    },
    paymentCount: {
      type: Number,
      required: true,
    },
    payment: {
      type: Number,
      required: true,
    },
    refundCount: {
      type: Number,
      required: true,
    },
    refund: {
      type: Number,
      required: true,
    },
    adjustmentsCount: {
      type: Number,
      required: true,
    },
    adjustments: {
      type: Number,
      required: true,
    },
    totalIncoming: {
      type: Number,
      required: true,
    },
    totalOutgoing: {
      type: Number,
      required: true,
    },
    recentlyDeposit: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: "createDate",
      updatedAt: null, // updatedAt will not be stored as part of the timestamp
    },
  }
);
let Balance = dynamoose.model("balance", balanceSchema);
module.exports = Balance;
