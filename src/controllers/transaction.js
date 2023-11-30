const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { common } = require("../util/helper");
const { responseCode, rs } = require("../util");
const { success } = require("../util/Constants");
const CustomerWalletAddress = require("../models/customerWalletAddress");
const Currency = require("../models/currency");
const moment = require("moment");
const TransactionLog = require("../models/transactionLog");

exports.merchantCustomerList = async (req, res) => {
  try {
    // console.log(req.user["id"]);

    let from_date = req.query?.from_date;
    let to_date = req.query?.to_date;

    let mCustomerList;
    let uniqueRecordsArray = [];

    if (from_date && to_date) {
      let fromDate = moment(from_date).valueOf();
      let toDate = moment(to_date)
        .add(23, "hours")
        .add(59, "minutes")
        .add(59, "seconds")
        .valueOf();

      if (fromDate > toDate) {
        return res
          .status(responseCode.badGateway)
          .json(rs.incorrectDetails("FROM DATE GREATER THAN TO DATE"));
      }

      mCustomerList = await TransactionLog.scan()
        .attributes([
          "id",
          "inwardCurrency",
          "createDate",
          "customerAddress",
          "email",
          "name",
        ])
        .where("user_id")
        .eq(req.user["id"])
        .where("txnStatus")
        .eq(true)
        .where("marketOrderStatus")
        .eq(true)
        .where("withdrawStatus")
        .eq(true)
        .where("action")
        .in(["deposit", "withdraw"])
        .filter("createDate")
        .between(fromDate, toDate)
        .exec();
      console.log("mCustomerList1", mCustomerList);
    } else {
      mCustomerList = await TransactionLog.scan()
        .attributes([
          "id",
          "inwardCurrency",
          "createDate",
          "customerAddress",
          "email",
          "name",
        ])
        .where("user_id")
        .eq(req.user["id"])
        .where("txnStatus")
        .eq(true)
        .where("marketOrderStatus")
        .eq(true)
        .where("withdrawStatus")
        .eq(true)
        .where("action")
        .in(["deposit", "withdraw"])
        .exec();
    }

    if (mCustomerList.count != 0) {
      // Iterate through the array and add records to the uniqueRecords object
      const uniqueRecords = {};

      // Iterate through the array and add records to the uniqueRecords object
      mCustomerList.forEach((record) => {
        if (!uniqueRecords.hasOwnProperty(record.address)) {
          uniqueRecords[record.address] = record;
        }
      });

      // Convert the unique records object back to an array
      uniqueRecordsArray = Object.values(uniqueRecords);

      console.log(uniqueRecordsArray);

      // let uniqueCurrencyList = Array.from(
      //   new Set(mCustomerList.map((e) => e.cryptoCurrency))
      // );
      const uniqueCurrencyList = [
        ...new Set(mCustomerList.map((e) => e.inwardCurrency).filter(Boolean)),
      ];

      let currencyList = await Currency.scan()
        .attributes(["currency", "logoUrl"])
        .where("isActive")
        .eq(true)
        .where("currency")
        .in(uniqueCurrencyList)
        .exec();

      uniqueRecordsArray.forEach((walletItem) => {
        // Find the first matching currency logo
        const matchingLogo = currencyList.find(
          (cLogo) => cLogo.currency === walletItem.cryptoCurrency
        );
        // If a matching logo is found, add it to the wallet item
        if (matchingLogo) {
          walletItem.logoUrl = matchingLogo.logoUrl;
        }
      });
    }

    return res
      .status(responseCode.success)
      .json(rs.successResponse("CUSTOMERS RETRIVED", uniqueRecordsArray));
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};

exports.internalMerchantCustomer = async (req, res) => {
  try {
    console.log(req.user["id"]);

    const { cid: customerWalletAddress } = req.params;

    if (customerWalletAddress === null || !customerWalletAddress) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE PASS THE TXN HASH"));
    }

    let mTransactionList;

    mTransactionList = await TransactionLog.scan()
      .where("user_id")
      .eq(req.user["id"])
      .where("txnStatus")
      .eq(true)
      .where("marketOrderStatus")
      .eq(true)
      .where("withdrawStatus")
      .eq(true)
      .where("action")
      .in(["deposit", "withdraw"])
      .where("customerAddress")
      .eq(customerWalletAddress)
      .exec();

    if (mTransactionList.count != 0) {
      // let uniqueCurrencyList = Array.from(
      //   new Set(mTransactionList.map((e) => e.cryptoCurrency))
      // );
      const uniqueCurrencyList = [
        ...new Set(
          mTransactionList.map((e) => e.inwardCurrency).filter(Boolean)
        ),
      ];

      let currencyList = await Currency.scan()
        .attributes(["currency", "logoUrl"])
        .where("isActive")
        .eq(true)
        .where("currency")
        .in(uniqueCurrencyList)
        .exec();

      mTransactionList.forEach((walletItem) => {
        // Find the first matching currency logo
        const matchingLogo = currencyList.find(
          (cLogo) => cLogo.currency === walletItem.cryptoCurrency
        );
        // If a matching logo is found, add it to the wallet item
        if (matchingLogo) {
          walletItem.logoUrl = matchingLogo.logoUrl;
        }
      });
    }

    return res
      .status(responseCode.success)
      .json(rs.successResponse("CUSTOMERS RETRIVED", mTransactionList));
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};

// exports.internalMerchantCustomer = async (req, res) => {
//   try {
//     console.log(req.user["id"]);

//     const { cid: customerWalletAddress } = req.params;

//     if (customerWalletAddress === null || !customerWalletAddress) {
//       return res
//         .status(responseCode.badRequest)
//         .json(rs.incorrectDetails("PLEASE PASS THE TXN HASH"));
//     }

//     let mTransactionList;

//     mTransactionList = await TransactionLog.scan()
//       .where("user_id")
//       .eq(req.user["id"])
//       .where("txnStatus")
//       .eq(true)
//       .where("customerAddress")
//       .eq(customerWalletAddress)
//       .exec();

//     if (mTransactionList.count != 0) {
//       let uniqueCurrencyList = Array.from(
//         new Set(mTransactionList.map((e) => e.cryptoCurrency))
//       );

//       let currencyList = await Currency.scan()
//         .attributes(["currency", "logoUrl"])
//         .where("isActive")
//         .eq(true)
//         .where("currency")
//         .in(uniqueCurrencyList)
//         .exec();

//       mTransactionList.forEach((walletItem) => {
//         // Find the first matching currency logo
//         const matchingLogo = currencyList.find(
//           (cLogo) => cLogo.currency === walletItem.cryptoCurrency
//         );
//         // If a matching logo is found, add it to the wallet item
//         if (matchingLogo) {
//           walletItem.logoUrl = matchingLogo.logoUrl;
//         }
//       });
//     }

//     return res
//       .status(responseCode.success)
//       .json(rs.successResponse("CUSTOMERS RETRIVED", mTransactionList));
//   } catch (err) {
//     return res
//       .status(responseCode.serverError)
//       .json(rs.errorResponse(err.toString()));
//   }
// };

exports.internalMerchantCustomerOne = async (req, res) => {
  try {
    console.log(req.user["id"]);
    const { txhash } = req.params;

    if (txhash === null || !txhash) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE PASS THE TXN HASH"));
    }

    let mTransaction;

    mTransaction = await TransactionLog.scan()
      .where("user_id")
      .eq(req.user["id"])
      .where("txHash")
      .eq(txhash)
      .where("txnStatus")
      .eq(true)
      .where("marketOrderStatus")
      .eq(true)
      .where("withdrawStatus")
      .eq(true)
      .where("action")
      .in(["deposit", "withdraw"])
      .exec();

    if (mTransaction.count != 0) {
      let currencyList = await Currency.scan()
        .attributes(["currency", "logoUrl"])
        .where("isActive")
        .eq(true)
        .where("currency")
        .eq(mTransaction[0]?.inwardCurrency)
        .exec();
      console.log("currencyList", currencyList);
      // return false

      mTransaction[0].logoUrl = currencyList?.[0]?.logoUrl || "";
    }

    return res
      .status(responseCode.success)
      .json(
        rs.successResponse(
          "CUSTOMERS RETRIVED",
          mTransaction.length > 0 ? mTransaction[0] : {}
        )
      );
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};

// exports.internalMerchantCustomerOne = async (req, res) => {
//   try {
//     console.log(req.user["id"]);
//     const { txhash } = req.params;

//     if (txhash === null || !txhash) {
//       return res
//         .status(responseCode.badRequest)
//         .json(rs.incorrectDetails("PLEASE PASS THE TXN HASH"));
//     }

//     let mTransaction;

//     mTransaction = await TransactionLog.scan()
//       .where("user_id")
//       .eq(req.user["id"])
//       .where("txHash")
//       .eq(txhash)
//       .where("txnStatus")
//       .eq(true)
//       .exec();

//     if (mTransaction.count != 0) {
//       let currencyList = await Currency.scan()
//         .attributes(["currency", "logoUrl"])
//         .where("isActive")
//         .eq(true)
//         .where("currency")
//         .eq(mTransaction[0]?.cryptoCurrency)
//         .exec();

//       mTransaction[0].logoUrl = currencyList[0].logoUrl;
//     }

//     return res
//       .status(responseCode.success)
//       .json(
//         rs.successResponse(
//           "CUSTOMERS RETRIVED",
//           mTransaction.length > 0 ? mTransaction[0] : {}
//         )
//       );
//   } catch (err) {
//     return res
//       .status(responseCode.serverError)
//       .json(rs.errorResponse(err.toString()));
//   }
// };

/**
 * @description This API is used to get the data regarding the all customer transactions
 */
// exports.internalMerchantCustomerList = async (req, res) => {
//   try {
//     console.log(req.user["id"]);

//     let mTransactionList;

//     mTransactionList = await TransactionLog.scan()
//       .where("user_id")
//       .eq(req.user["id"])
//       .where("txnStatus")
//       .eq(true)
//       .exec();

//     if (mTransactionList.count != 0) {
//       let uniqueCurrencyList = Array.from(
//         new Set(mTransactionList.map((e) => e.cryptoCurrency))
//       );

//       let currencyList = await Currency.scan()
//         .attributes(["currency", "logoUrl"])
//         .where("isActive")
//         .eq(true)
//         .where("currency")
//         .in(uniqueCurrencyList)
//         .exec();

//       mTransactionList.forEach((walletItem) => {
//         // Find the first matching currency logo
//         const matchingLogo = currencyList.find(
//           (cLogo) => cLogo.currency === walletItem.cryptoCurrency
//         );
//         // If a matching logo is found, add it to the wallet item
//         if (matchingLogo) {
//           walletItem.logoUrl = matchingLogo.logoUrl;
//         }
//       });
//     }

//     return res
//       .status(responseCode.success)
//       .json(rs.successResponse("CUSTOMERS RETRIVED", mTransactionList));
//   } catch (err) {
//     return res
//       .status(responseCode.serverError)
//       .json(rs.errorResponse(err.toString()));
//   }
// };

exports.internalMerchantCustomerList = async (req, res) => {
  try {
    console.log(req.user["id"]);
    let mTransactionList;

    let from_date = req.query?.from_date;
    let to_date = req.query?.to_date;

    if (from_date && to_date) {
      let fromDate = moment(from_date).valueOf();
      let toDate = moment(to_date)
        .add(23, "hours")
        .add(59, "minutes")
        .add(59, "seconds")
        .valueOf();

      if (fromDate > toDate) {
        return res
          .status(responseCode.badGateway)
          .json(rs.incorrectDetails("FROM DATE GREATER THAN TO DATE"));
      }

      mTransactionList = await TransactionLog.scan()
        .where("user_id")
        .eq(req.user["id"])
        .where("txnStatus")
        .eq(true)
        .where("marketOrderStatus")
        .eq(true)
        .where("withdrawStatus")
        .eq(true)
        .where("action")
        .in(["deposit", "withdraw"])
        .filter("createDate")
        .between(fromDate, toDate)
        .exec();
    } else {
      mTransactionList = await TransactionLog.scan()
        .where("user_id")
        .eq(req.user["id"])
        .where("txnStatus")
        .eq(true)
        .where("marketOrderStatus")
        .eq(true)
        .where("withdrawStatus")
        .eq(true)
        .where("action")
        .in(["deposit", "withdraw"])
        .exec();
    }

    if (mTransactionList.count != 0) {
      const uniqueCurrencyList = [
        ...new Set(
          mTransactionList.map((e) => e.inwardCurrency).filter(Boolean)
        ),
      ];
      let currencyList = await Currency.scan()
        .attributes(["currency", "logoUrl"])
        .where("isActive")
        .eq(true)
        .where("currency")
        .in(uniqueCurrencyList)
        .exec();
      console.log("currencyList", currencyList);

      mTransactionList.forEach((walletItem) => {
        // Find the first matching currency logo
        const matchingLogo = currencyList.find(
          (cLogo) => cLogo.currency === walletItem.cryptoCurrency
        );
        // If a matching logo is found, add it to the wallet item
        if (matchingLogo) {
          walletItem.logoUrl = matchingLogo.logoUrl;
        }
      });
    }

    return res
      .status(responseCode.success)
      .json(rs.successResponse("CUSTOMERS RETRIVED", mTransactionList));
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};
