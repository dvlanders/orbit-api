const dynamoose = require("dynamoose");

const bankSchema = new dynamoose.Schema(
  {
    id: String,
    user_id : String,
    status: String,
    requires_verification: Number,
    requires_support: Number,
    routing_number: String,
    account_number: String,
    name1: String,
    currency: String,
    type: String,
    bank_name: String,
    ach_enabled: Boolean,
    international_bank: Boolean,
    ref_id: String,
    wire_withdrawal_fee: Number,
    verificationSent : Boolean,
    verifiedStatus : String
  },
  {
    timestamps: {
      createdAt: "createDate",
      updatedAt: null, // updatedAt will not be stored as part of the timestamp
    },
  }
);
let bankAccountSchema = dynamoose.model("bankAccount", bankSchema);
module.exports = bankAccountSchema;