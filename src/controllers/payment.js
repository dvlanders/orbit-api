const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const transactions = require("./../models/transactions");
const { logger } = require("../util/logger/logger");
const User = require("./../models/userAuth");
const Transactions = require("./../models/transactions");
const { common } = require("../util/helper");
const { responseCode, rs, messages, userApiPath } = require("../util");

let token = process.env.SFOX_ENTERPRISE_API_KEY;

/**
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
    let finalData;

    if (type == "PAYOUT") {
      finalData = response.data.data;
      for (let i = 0; i < finalData.length; i++) {
        const userDetails = await User.scan()
          .where("sfox_id")
          .eq(finalData[i].user_id)
          .exec();
        let responses, bank;
        if (userDetails[0]?.userToken) {
          let apiBankPath = `${process.env.SFOX_BASE_URL}/v1/user/bank`;
          responses = await axios({
            method: "get",
            url: apiBankPath,
            headers: {
              Authorization: "Bearer " + userDetails[0]?.userToken,
            },
          });
          finalData[i].bankAccount = responses?.data.usd[0].account_number;
        } else {
          finalData[i].bankAccount = "";
        }
        finalData[i].email = userDetails[0]?.email;
      }
    }

    common.eventBridge(
      "Transfer History Retrived Successfully",
      responseCode.success
    );
    return res.status(responseCode.success).json(
      rs.successResponse("TRANFER HISTORY RETRIVED", {
        data: finalData,
        count: response.data.data.length,
      })
    );
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error?.response?.status).send(error?.response?.data);
  }
};

// transactio history

exports.transaction = async (req, res) => {
  try {
    let responses;
    const { transfer_id, user_id } = req.params;
    if (!transfer_id || !user_id)
      return res
        .status(responseCode.badRequest)
        .json(rs.dataNotAdded("PROVIDE TRANSFER ID OR USERID", {}));
    const { from_date, to_date, limit, offset, type } = req.query;
    let query = {
      from_date: from_date ? from_date : null,
      to_date: to_date ? to_date : null,
      limit: limit ? limit : null,
      offset: offset ? offset : null,
      type: type ? type : null,
    };
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
      params: query,
    });
    if (response.data.length > 0)
      for (let i = 0; i < response.data.length; i++) {
        if (response.data[i].IdempotencyId == transfer_id) {
          let transx = await Transactions.scan()
            .where("IdempotencyId")
            .eq(transfer_id)
            .exec();
          if (transx.length > 0) {
            responses = [
              {
                id: transx[0].id,
                amount: transx[0].amount ? transx[0].amount : null,
                transactionFee: transx[0].AccountTransferFee
                  ? transx[0].AccountTransferFee
                  : null,
                orderId: transx[0].order_id ? transx[0].order_id : null,
                customerId: transx[0].client_order_id
                  ? transx[0].client_order_id
                  : null,
                fees: transx[0].fees ? transx[0].fees : null,
                status: transx[0].status ? transx[0].status : null,
                description: transx[0].description
                  ? transx[0].description
                  : null,
                net: transx[0].net_proceeds ? transx[0].net_proceeds : null,
                statementDescriptor: getUser[0].email ? getUser[0].email : null,
                totalAmountReceived: null,
                amountPaid: null,
                ordertotal: null,
              },
            ];
          } else {
            const transaction = new Transactions({
              id: response.data[i].id.toString(),
              atxid: response.data[i].atxid,
              order_id: response.data[i].order_id,
              client_order_id: response.data[i].client_order_id,
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
              algo_name: response.data[i].algo_name,
              algo_id: response.data[i].algo_id,
              account_balance: response.data[i].account_balance,
              TransactionFee: response.data[i].AccountTransferFee,
              description: response.data[i].description,
              wallet_display_id: response.data[i].wallet_display_id,
              added_by_user_email: response.data[i].added_by_user_email,
              symbol: response.data[i].symbol
                ? response.data[i].symbol
                : "null",
              IdempotencyId: response.data[i].IdempotencyId,
              timestamp: response.data[i].timestamp,
              statementDescriptor: getUser[0].email,
              user_id: getUser[0].user_id,
              total_amount_received: null,
              amountPaid: null,
              ordertotal: null,
            });
            let transferAdded = await transaction.save();
            logger.info(`Retrived transactions`, transferAdded);
            transx = await Transactions.scan()
              .where("IdempotencyId")
              .eq(transfer_id)
              .exec();
            responses = [
              {
                id: transx[0].id,
                amount: transx[0].amount ? transx[0].amount : null,
                transactionFee: transx[0].AccountTransferFee
                  ? transx[0].AccountTransferFee
                  : null,
                orderId: transx[0].order_id ? transx[0].order_id : null,
                customerId: transx[0].client_order_id
                  ? transx[0].client_order_id
                  : null,
                fees: transx[0].fees ? transx[0].fees : null,
                status: transx[0].status ? transx[0].status : null,
                description: transx[0].description
                  ? transx[0].description
                  : null,
                net: transx[0].net_proceeds ? transx[0].net_proceeds : null,
                statementDescriptor: getUser[0].email ? getUser[0].email : null,
                totalAmountReceived: null,
                amountPaid: null,
                ordertotal: null,
              },
            ];
          }
        } else {
          return res
            .status(responseCode.badRequest)
            .json(rs.dataNotAdded("PROVIDE CORRECT TRANSFERID", {}));
        }
      }

    return res
      .status(response.status)
      .json(rs.successResponse("RETRIVED TRANSACTIONS", responses));
  } catch (err) {
    console.log("error", err);
    return res.status(err?.response?.status || 500).send(err?.response?.data);
  }
};

exports.transactionUpdate = async (req, res) => {
  try {
    const { description } = req.body;
    const { user_id, trx_id } = req.params;

    if (!description)
      res.json(rs.incorrectDetails("PLEASE ENTER THE DESCRIPTION", {}));

    const transx = await Transactions.scan()
      .where("user_id")
      .eq(user_id)
      .where("id")
      .eq(trx_id)
      .exec();

    if (transx?.count === 0)
      return res
        .status(responseCode.notFound)
        .json(
          rs.response(responseCode.notFound, "TRANSACTION DOES NOT EXIST ", {})
        );

    await Transactions.update(
      { id: transx[0].id },
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
    return res.status(response.status).json({
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
    return res.status(response.status).json({
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
    return res.status(response.status).json({
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
    return res.status(response.status).json({
      message: response.data.data,
    });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

// balances

exports.balances = async (req, res) => {
  try {
    const { user_id } = req.params;
    const userDetails = await User.get(user_id);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/user/balance`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
    });
    console.log(response.data);
    return res
      .status(response.status)
      .json(rs.successResponse("RETRIVED BALANCE", response.data));
  } catch (err) {
    return res.status(err.response.status).send(err.response.data);
  }
};
