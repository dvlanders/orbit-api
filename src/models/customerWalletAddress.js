const dynamoose = require("dynamoose");

const customerWalletAddressSchema = new dynamoose.Schema(
  {
    id: String,
    address: String,
    currency: String,
    walletType: String,
    user_id: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  {
    timestamps: {
      createdAt: "createDate",
      updatedAt: null, // updatedAt will not be stored as part of the timestamp
    },
  }
);
let CustomerWalletAddress = dynamoose.model(
  "customerWalletAddress",
  customerWalletAddressSchema
);
module.exports = CustomerWalletAddress;
