const dynamoose = require("dynamoose");

const personSchema = new dynamoose.Schema(
  {
    id: String, // Primary Key
    userToken: String,
  },
  {
    timestamps: {
      createdAt: "createDate",
      updatedAt: null, // updatedAt will not be stored as part of the timestamp
    },
  }
);
let db = dynamoose.model("auth_user", personSchema);
module.exports = db;
