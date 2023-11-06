const dynamoose = require("dynamoose");

const walletAddressSchema = new dynamoose.Schema(
  {
    id: String,
    address: String,
    currency: String,
    user_id: {
      type: String,
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
let WalletAddress = dynamoose.model("walletAddress", walletAddressSchema);
module.exports = WalletAddress;
