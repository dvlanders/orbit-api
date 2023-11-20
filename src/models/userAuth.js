const dynamoose = require("dynamoose");
const personSchema = new dynamoose.Schema(
  {
    user_id: String, // Primary Key
    userToken: String,
    email: String,
    password: String,
    phoneNumber: String,
    fullName: String,
    businessName: String,
    isVerified: {
      type: Boolean,
      default: false,
    },
    logoUrl: String,
    secretkey: String,
    sfox_id: {
      type: String,
      default: "",
    },
    isSfoxVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      required: false,
    },
    otpTimestamp: {
      type: Number,
      required: false,
    },
    isOTPVerified: {
      type: Boolean,
      default: false,
    },
    timeZone: {
      type: String,
      default: "America/New_York",
    },
    invitedBy: {
      type: [String, dynamoose.type.NULL],
      default: null,
    },
    role: {
      type: Number,
      default: 0, // 0 for superadmin
    },
    isAccepted: {
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

let User = dynamoose.model("users", personSchema);
module.exports = User;
