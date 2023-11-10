const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const User = require("./../models/userAuth");
const payment = require("./payment");
const { common } = require("../util/helper");
const { responseCode, rs } = require("../util");
const { success } = require("../util/Constants");
const CustomerWalletAddress = require("../models/customerWalletAddress");

exports.merchantCustomer = async (req, res) => {
  try {
    console.log(req.user["id"]);
    let from_date = req.query?.from_date;
    let to_date = req.query?.to_date;

    let mCustomerList = await CustomerWalletAddress.scan()
      .attributes(["id", "currency", "createDate", "address", "email", "name"])
      .where("user_id")
      .eq(req.user["id"])
      .exec();

    return res
      .status(responseCode.success)
      .json(rs.successResponse("CUSTOMERS RETRIVED", mCustomerList));
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};
