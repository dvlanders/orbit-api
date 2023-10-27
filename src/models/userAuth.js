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
    secretkey: String,
    sfox_id: {
      type: String,
      default: "",
    },
    timeZone : {
      type : String,
      default : "America - New York"
    }
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
