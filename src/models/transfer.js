const dynamoose = require("dynamoose");

const transferSchema = new dynamoose.Schema(
  {
    transfer_id: String,
    transfer_status_code: String,
    type: String,
    quantity: Number,
    currency: String,
    user_id: {
      type: String,
      required: true,
    },
    rate: Number,
    purpose: String,
    description: String,
    atx_id_charged: Number,
    atx_id_credited: Number,
    atx_status_charged: Number,
    atx_status_credited: Number,
    transfer_date: String,
  },
  {
    timestamps: {
      createdAt: "createDate",
      updatedAt: null, // updatedAt will not be stored as part of the timestamp
    },
  }
);
let Transfer = dynamoose.model("transfer", transferSchema);
module.exports = Transfer;
