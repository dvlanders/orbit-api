const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const User = require("./../models/userAuth");
const payment = require("./payment");
const { common } = require("../util/helper");
const { responseCode, rs } = require("../util");
const { success } = require("../util/Constants");
const CustomerWalletAddress = require("../models/customerWalletAddress");
const Currency = require("../models/currency");
const moment = require("moment");
const { response } = require("../util/ResponseTemplate");

exports.merchantCustomer = async (req, res) => {
  try {
    console.log(req.user["id"]);
    let from_date = req.query?.from_date;
    let to_date = req.query?.to_date;

    let mCustomerList;

    if (from_date && to_date) {
      let fromDate = moment(from_date).valueOf();
      let toDate = moment(to_date).valueOf();

      if (fromDate > toDate) {
        return res
          .status(responseCode.badGateway)
          .json(rs.incorrectDetails("FROM DATE GREATER THAN TO DATE"));
      }

      mCustomerList = await CustomerWalletAddress.scan()
        .attributes([
          "id",
          "currency",
          "createDate",
          "address",
          "email",
          "name",
        ])
        .where("user_id")
        .eq(req.user["id"])
        .filter("createDate")
        .between(fromDate, toDate)
        .exec();
    } else {
      mCustomerList = await CustomerWalletAddress.scan()
        .attributes([
          "id",
          "currency",
          "createDate",
          "address",
          "email",
          "name",
        ])
        .where("user_id")
        .eq(req.user["id"])
        .exec();
    }

    console.log(mCustomerList);

    if (mCustomerList.count != 0) {
      let uniqueCurrencyList = Array.from(
        new Set(mCustomerList.map((e) => e.currency))
      );
      let currencyList = await Currency.scan()
        .attributes(["currency", "logoUrl"])
        .where("isActive")
        .eq(true)
        .where("currency")
        .in(uniqueCurrencyList)
        .exec();

      mCustomerList.forEach((walletItem) => {
        // Find the first matching currency logo
        const matchingLogo = currencyList.find(
          (cLogo) => cLogo.currency === walletItem.currency
        );
        // If a matching logo is found, add it to the wallet item
        if (matchingLogo) {
          walletItem.logoUrl = matchingLogo.logoUrl;
        }
      });
    }

    return res
      .status(responseCode.success)
      .json(rs.successResponse("CUSTOMERS RETRIVED", mCustomerList));
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};
