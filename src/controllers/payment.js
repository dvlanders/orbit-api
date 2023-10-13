const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { responseCode } = require("../util");

let uuid = uuidv4();
let token = process.env.SFOX_ENTERPRISE_API_KEY;

let userToken = process.env.USER_AUTH_TOKEN;
let baseUrl = process.env.SFOX_BASE_URL;

const { sendEmail, common } = require("../util/helper");

// get transfer
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

    let apiPath = `${baseUrl}/v1/enterprise/transfer/history`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      params: query,
    });

    common.eventBridge(
      "Transfer History Retrived Successfully",
      responseCode.badRequest
    );
    return res
      .status(responseCode.success)
      .json({ message: response.data.data });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

// monetization code

exports.monetization = async (req, res) => {
  try {
    const { feature, method, amount, user_id } = req.body;
    let apiPath = `${baseUrl}/v1/enterprise/monetization/settings`;
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
    let apiPath = `${baseUrl}/v1/enterprise/monetization/settings/:${monetization_id}`;
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
    let apiPath = `${baseUrl}/v1/enterprise/monetization/settings/:${monetization_id}`;
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
    let apiPath = `${baseUrl}/v1/enterprise/monetization/history?${feature}`;
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
    let apiPath = `${baseUrl}/v1/user/balance`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (err) {
    return res.status(err.response.status).send(err.response.data);
  }
};
