const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("../models/transfer");
const { logger } = require("../util/logger/logger");
const User = require("./../models/userAuth");
const Transactions = require("./../models/transactions");
const payment = require("./payment");
const { common } = require("../util/helper");
const { responseCode, rs } = require("../util");
const bankAccountSchema = require("../models/bankAccounts");
const { success, responseCodes } = require("../util/Constants");
const TransactionLog = require("../models/transactionLog");
const moment = require("moment");

let token = process.env.SFOX_ENTERPRISE_API_KEY;

/**
 * For the Payment and the Payout page
 * @description
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.transfer = async (req, res) => {
  try {
    const { from_date, to_date, purpose, status, type } = req.query;
    let query = {
      from_date: from_date ? from_date : null,
      to_date: to_date ? to_date : null,
      purpose: purpose ? purpose : null,
      status: status ? status : null,
      type: type ? type : null,
    };

    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/transfer/history`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      params: query,
    });
    let finalData = await Transfer.scan().where("type").eq(type).exec();

    for (let i = 0; i < finalData.length; i++) {
      let users = await User.scan()
        .where("user_id")
        .eq(finalData[i].user_id)
        .exec();
      if (type == "PAYOUT") {
        let bank = await bankAccountSchema
          .scan()
          .where("user_id")
          .eq(finalData[i].user_id)
          .where("verifiedStatus")
          .eq("Success")
          .where("status")
          .eq("active")
          .exec();
        if (bank.length > 0) {
          finalData[i].bankAccount = bank[0].account_number;
          finalData[i].bankName = bank[0].bank_name;
        } else {
          finalData[i].bankAccount = null;
          finalData[i].bankName = null;
        }

        if (users[0].email) {
          finalData[i].email = users[0].email;
        } else {
          finalData[i].email = null;
        }
      } else if (type == "PAYMENT") {
        if (users[0].email) {
          finalData[i].email = users[0].email;
        }
        //finalData[i].email = null
      }
    }

    common.eventBridge(
      "Transfer History Retrived Successfully",
      responseCode.success
    );
    if (res) {
      return res.status(responseCode.success).json(
        rs.successResponse("TRANFER HISTORY RETRIVED", {
          data: finalData,
          count: response.data.data.length,
        })
      );
    } else {
      return { data: finalData, count: response.data.data.length };
    }
  } catch (error) {
    console.log("error", error);
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    if (res) {
      return res
        .status(error?.response?.status || 500)
        .send(error?.response?.data || error);
    } else return error;
  }
};

exports.internalTransaction = async (req, res) => {
  try {
    const { user_id, transaction_id } = req.params;
    if (!user_id || !transaction_id)
      return res
        .status(responseCode.badRequest)
        .json(rs.dataNotAdded("PROVIDE USERID OR TRANSFERID", {}));
    const count = await User.scan().exec();
    var getUser = count.filter((item) => item.user_id == user_id);
    if (getUser.length == 0 || getUser[0].userToken == "") {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let transx = await Transactions.scan()
      .where("id")
      .eq(transaction_id)
      .exec();
    let responses = {
      id: transx[0].id,
      amount: transx[0].amount ? transx[0].amount : null,
      transactionFee: transx[0].AccountTransferFee
        ? transx[0].AccountTransferFee
        : null,
      orderId: transx[0].order_id ? transx[0].order_id : null,
      customerEmail: null,
      fees: transx[0].fees ? transx[0].fees : null,
      status: transx[0].status ? transx[0].status : null,
      description: transx[0].description ? transx[0].description : "",
      net: transx[0].net_proceeds ? transx[0].net_proceeds : null,
      statementDescriptor: getUser[0].email ? getUser[0].email : null,
      totalAmountReceived: null,
      amountPaid: null,
      ordertotal: null,
      date: transx[0].day,
    };
    return res
      .status(responseCode.success || 200)
      .json(rs.successResponse("RETRIVED TRANSACTIONS", responses));
  } catch (err) {
    console.log("error", err);
    return res
      .status(responseCode.serverError || 500)
      .send(rs.errorResponse("Error", err));
  }
};

exports.transaction = async (req, res) => {
  try {
    let responses = [];
    const { user_id } = req.params;
    let query;
    if (!user_id)
      return res
        .status(responseCode.badRequest)
        .json(rs.dataNotAdded("PROVIDE USERID", {}));

    if (req.query) {
      const { from_date, to_date, limit, offset, type } = req.query;

      query = {
        from: from_date ? from_date : null,
        to: to_date ? to_date : null,
        limit: limit ? limit : null,
        offset: offset ? offset : null,
        type: type ? type : null,
      };
    }
    const count = await User.scan().exec();
    var getUser = count.filter((item) => item.user_id == user_id);

    if (getUser.length == 0 || getUser[0].userToken == "") {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + getUser[0].userToken,
      },
      params: query ? query : null,
    });

    if (response.data.length > 0)
      for (let i = 0; i < response.data.length; i++) {
        let transx = await Transactions.scan()
          .where("atxid")
          .eq(response.data[i].atxid)
          .exec();

        if (transx.length > 0) {
          responses.push({
            id: transx[0].id,
            amount: transx[0].amount ? transx[0].amount : null,
            customerEmail: null,
            status: transx[0].status ? transx[0].status : null,
            description: transx[0].description ? transx[0].description : "",
            statementDescriptor: getUser[0].email ? getUser[0].email : null,
            date: transx[0].day ? transx[0].day : null,
          });
        } else {
          const transaction = new Transactions({
            id: response.data[i].id ? response.data[i].id.toString() : "0",
            atxid: response.data[i].atxid ? response.data[i].atxid : "",
            order_id: response.data[i].order_id
              ? response.data[i].order_id
              : "",
            client_order_id: response.data[i].client_order_id
              ? response.data[i].client_order_id
              : "",
            day: response.data[i].day,
            action: response.data[i].action,
            currency: response.data[i].currency,
            memo: response.data[i].memo,
            amount: response.data[i].amount,
            net_proceeds: response.data[i].net_proceeds,
            price: response.data[i].price,
            fees: response.data[i].fees,
            status: response.data[i].status,
            hold_expires: response.data[i].hold_expires,
            tx_hash: response.data[i].tx_hash,
            algo_name: response.data[i].algo_name
              ? response.data[i].algo_name
              : "",
            algo_id: response.data[i].algo_id ? response.data[i].algo_id : "",
            account_balance: response.data[i].account_balance
              ? response.data[i].account_balance
              : 0,
            TransactionFee: response.data[i].AccountTransferFee,
            description: response.data[i].description
              ? response.data[i].description
              : null,
            wallet_display_id: response.data[i].wallet_display_id,
            added_by_user_email: response.data[i].added_by_user_email,
            symbol: response.data[i].symbol ? response.data[i].symbol : "null",
            IdempotencyId: response.data[i].IdempotencyId
              ? response.data[i].IdempotencyId
              : "",
            timestamp: response.data[i].timestamp,
            statementDescriptor: getUser[0].email,
            user_id: getUser[0].user_id,
            total_amount_received: null,
            amountPaid: null,
            ordertotal: null,
            date: response.data[i].day,
          });
          let transferAdded = await transaction.save();
          logger.info(`Retrived transactions`, transferAdded);
          transx = await Transactions.scan()
            .where("atxid")
            .eq(response.data[i].atxid)
            .exec();
          responses.push({
            id: transx[0].id,
            amount: transx[0].amount ? transx[0].amount : null,
            customerEmail: null,
            status: transx[0].status ? transx[0].status : null,
            description: transx[0].description ? transx[0].description : "",
            statementDescriptor: getUser[0].email ? getUser[0].email : null,
            date: transx[0].day ? transx[0].day : null,
          });
        }
      }

    if (responses == undefined) {
      return res
        .status(responseCode.badRequest)
        .json(
          rs.response(
            responseCode.badRequest,
            "PLEASE PROVIDE CORRECT TRANSFER ID",
            {}
          )
        );
    }
    if (res) {
      return res
        .status(responseCode.successCreated)
        .json(rs.successResponse("RETRIVED TRANSACTIONS", responses));
    } else {
      return responses;
    }
  } catch (err) {
    console.log("error", err);
    return res.status(err?.response?.status || 500).send(err?.response?.data);
  }
};

exports.tranferUpdate = async (req, res) => {
  try {
    console.log("tranferUpdate");
    const { description } = req.body;
    const { user_id, trx_id } = req.params;

    if (!user_id || !trx_id || !description) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    const userDetails = await User.get(user_id);
    console.log(userDetails);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    console.log(user_id, "smdbkaj", trx_id);

    const transx = await Transfer.scan()
      .where("transfer_id")
      .eq(trx_id)
      .where("user_id")
      .eq(user_id)
      .exec();
    console.log(transx);

    if (transx?.count === 0)
      return res
        .status(responseCode.notFound)
        .json(
          rs.response(responseCode.notFound, "TRANSACTION DOES NOT EXIST ", {})
        );

    await Transfer.update(
      { transfer_id: transx[0].transfer_id },
      { description: description }
    );

    return res.json(rs.successResponse("DESCRIPTION UPDATED", {}));
  } catch (err) {
    console.log("error", err);
    return res.status(err?.response?.status || 500).send(err?.response?.data);
  }
};

// monetization code
exports.monetization = async (req, res) => {
  try {
    const { feature, method, amount, user_id } = req.body;
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/monetization/settings`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: {
        feature: feature,
        amount: amount,
        method: method,
        user_id: user_id,
      },
    });
    return res.status(responseCode.success).json({
      message: response.data.data,
    });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.updateMonetization = async (req, res) => {
  try {
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/monetization/settings/:${monetization_id}`;
    let response = await axios({
      method: "patch",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: {
        new_monetization_amount: req.body.new_monetization_amount,
      },
    });
    return res.status(responseCode.success).json({
      message: response.data.data,
    });
  } catch (error) {
    common.eventBridge(
      error.response.data.toString(),
      responseCode.serverError
    );
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.deleteMonetization = async (req, res) => {
  try {
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/monetization/settings/:${monetization_id}`;
    let response = await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return res.status(responseCode.success).json({
      message: response.data.data,
    });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.monetizationHistory = async (req, res) => {
  try {
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/monetization/history?${feature}`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return res.status(responseCode.success).json({
      message: response.data.data,
    });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

/**
 * @description Balnaces Code
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.balances = async (req, res) => {
  try {
    const firstDayOfMonth = moment().startOf("month").valueOf();
    const currentDate = moment().endOf("day").valueOf();

    console.log(firstDayOfMonth);
    console.log(currentDate);

    let apiPath = `${process.env.SFOX_BASE_URL}/v1/user/balance`;
    let checkBalance = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + req.user["userToken"],
      },
    });

    let balance = [];
    if (checkBalance?.data) {
      balance = checkBalance?.data?.filter((e) => e.currency === "usd");
    }
    console.log(balance);

    return res.send(false);

    // let transaction = await TransactionLog.scan()
    //   .where("user_id")
    //   .eq(req.user["id"])
    //   .where("txnStatus")
    //   .eq(true)
    //   .where("marketOrderStatus")
    //   .eq(true)
    //   .where("withdrawStatus")
    //   .eq(true)
    //   .filter("createDate")
    //   .between(firstDayOfMonth, currentDate)
    //   .exec();

    // // return false
    // let payment = 0;
    // let payment_count = 0;
    // let refund_count = 0;
    // let refund = 0;
    // let adjustments = 0;
    // let total_incoming = 0;
    // let total = 0;
    // // let totalIncoming;
    // // let totalOutgoing;
    // // if (transaction.count > 0) {
    // //   transaction.map((e) => {
    // //     payment += e.inwardBaseAmount;
    // //     payment_count += 1;
    // //   });
    // // }
    // if (transaction.count > 0) {
    //   transaction.forEach((transaction) => {
    //     if (transaction.action === "deposit") {
    //       payment += transaction.outwardBaseAmount;
    //       payment_count += 1;
    //     } else if (transaction.action === "withdraw") {
    //       refund += transaction.inwardBaseAmount;
    //       refund_count += 1;
    //     }
    //   });
    // }
    // console.log(payment);
    // console.log(refund);

    // // total = payment - refund - adjustments;
    // total = balance?.[0]?.balance || 0;
    // return res.status(responseCode.success).json(
    //   rs.successResponse("BALANCE RETRIVED", {
    //     currently_way_to_bank_account: 0,
    //     estimate_future_payouts: 0,
    //     payment_count: payment_count,
    //     payment: payment,
    //     refund_count: refund_count,
    //     refund: refund,
    //     adjustments_count: 0,
    //     adjustments: 0,
    //     total_incoming: 0,
    //     total_outgoing: 0,
    //     recently_deposit: 0,
    //     currency: "usd",
    //     total: total,
    //   })
    // );
  } catch (err) {
    console.log("err", err?.response?.data);
    return res
      .status(err?.response?.status || 500)
      .json(rs.errorResponse(err?.response?.data, err?.response?.status));
  }
};

// for (let i = 0; i < paymentData.length; i++) {
//   const currentDate = new Date(); // Get the current date and time
//   const targetDate = new Date(paymentData[i].date); // Replace with the date you want to compare
//   const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

//   if (currentDate - targetDate < twentyFourHoursInMilliseconds) {
//     payCount.push(paymentData[i]);
//     pay = pay + paymentData[i].amount - refund - monetization - adjustments;
//     console.log("Target date is less than 24 hours old.");
//   } else {
//     // The target date is more than 24 hours old
//     console.log("Target date is 24 hours or more old.");
//   }
// }
// let totalTransactions = pay - refund - adjustments - monetization;

// let responses = {
//   currently_way_to_bank_account: 0,

//   estimate_future_payouts: 0,

//   payment_count: payCount.length ? payCount.length : 0,

//   payment: pay,

//   refund_count: 0,

//   refund: 0,

//   adjustments_count: 0,

//   adjustments: 0,

//   total_incoming: totalTransactions,

//   total_outgoing: 0,

//   recently_deposit: 0,
// };
// for (let i = 0; i < response.data.length; i++) {
//   if (response.data[i].currency == currency) {
//     responses.currency = response.data[i].currency;
//     responses.total = response.data[i].balance - pay;
//   }
// }
// let request = { query: { type: "PAYMENT" } };

// let transferData = await this.transfer(request);
