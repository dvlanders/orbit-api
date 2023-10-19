const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const transactions = require("./../models/transactions");
const {logger} = require("../util/logger/logger");
const User = require("./../models/userAuth");
const {common } = require("../util/helper");
const { responseCode, rs, messages } = require("../util");


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

    let apiPathuser = `${process.env.SFOX_BASE_URL}/v1/enterprise/users`;
    let responseuser = await axios({
      method: "get",
      url: apiPathuser,
      headers: {
        Authorization: "Bearer " + token,
      },
    });


    data = response.data.data.map((item) => {
      const matchingUser = responseuser?.data?.data.find(
        (user) => user.user_id === item.user_id
      );
      if (matchingUser) {
        item.email = matchingUser.email;
      }
      return item;
    });

    common.eventBridge(
      "Transfer History Retrived Successfully",
      responseCode.success
    );
    return res.status(responseCode.success).json(
      rs.successResponse("TRANFER HISTORY RETRIVED", {
        data: response.data.data,
        count: response.data.data.length,
      })
    );
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

// transactio history

exports.transaction = async (req, res) => {
  try {
    const {user_id} = req.params;
    const { from, to, limit, offset, type } = req.query;
    let query = {
      from: from ? from : null,
      to: to ? to : null,
      limit: limit ? limit : null,
      offset: offset ? offset : null,
      type: type ? type : null,
    };
    const count = await User.scan().exec()
    var getUser = count.filter((item) => item.user_id == user_id);

    if(getUser.length == 0 || getUser[0].userToken == ""){
      common.eventBridge(
        "USER NOT FOUND",
        responseCode.badRequest
      );
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
    if (response.data[0]) {
      const transaction = new transactions({
        id: response.data[0].id.toString(),
        atxid: response.data[0].atxid,
        order_id: response.data[0].order_id,
        client_order_id: response.data[0].client_order_id,
        day: response.data[0].day,
        action: response.data[0].action,
        currency: response.data[0].currency,
        memo: response.data[0].memo,
        amount: response.data[0].amount,
        net_proceeds: response.data[0].net_proceeds,
        price: response.data[0].price,
        fees: response.data[0].fees,
        status: response.data[0].status,
        hold_expires: response.data[0].hold_expires,
        tx_hash: response.data[0].tx_hash,
        algo_name: response.data[0].algo_name,
        algo_id: response.data[0].algo_id,
        account_balance: response.data[0].account_balance,
        AccountTransferFee: response.data[0].AccountTransferFee,
        description: response.data[0].description,
        wallet_display_id: response.data[0].wallet_display_id,
        added_by_user_email: response.data[0].added_by_user_email,
        symbol: response.data[0].symbol ?response.data[0].symbol : "null" ,
        IdempotencyId: response.data[0].IdempotencyId,
        timestamp: response.data[0].timestamp
      });
      let transferAdded = await transaction.save();
      logger.info(`Retrived transactions`, transferAdded)

      let responses = {
        // "email" : ""
        //  "payment method" : ""
        "amount": response.data[0].amount,
        "AccountTransferFee" : response.data[0].AccountTransferFee,
        "order_id" : response.data[0].order_id,
        "client_order_id" : response.data[0].client_order_id,
        "fees": response.data[0].fees,
        "status": response.data[0].status,
        "description"  : response.data[0].description,
        "net" : response.data[0].net_proceeds
      }
    return res
      .status(response.status)
      .json(rs.successResponse("RETRIVED TRANSACTIONS", responses));
    }
  } catch (err) {
    console.log("error",err)
    return res.status(err.response?.status).send(err.response?.data);
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
    return res.status(response.status).json({ message: response.data.data });
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
    return res.status(response.status).json({ message: response.data.data });
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
    return res.status(response.status).json({ message: response.data.data });
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
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

// balances

exports.balances = async (req, res) => {
  try {
    const {user_id} = req.params;
    const count = await User.scan().exec()
    var getUser = count.filter((item) => item.user_id == user_id);

    if(getUser.length == 0 || getUser[0].userToken == ""){
      common.eventBridge(
        "USER NOT FOUND",
        responseCode.badRequest
      );
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/user/balance`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + getUser[0].userToken,
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
