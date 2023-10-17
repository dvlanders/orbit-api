const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("./../models/transfer");

let userToken = process.env.USER_AUTH_TOKEN;
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
let uuid = uuidv4();
const { sendEmail, common } = require("../util/helper");
const { responseCode, rs } = require("../util");

//Transfer

exports.transfer = async (req, res) => {
  try {
    // const userDetails = await User.scan()
    //   .where("user_id")
    //   .eq(req.body.user_id)
    //   .exec();
    // console.log(userDetails);

    // if (userDetails?.count === 0)
    //   return res
    //     .status(responseCode.notFound)
    //     .json(rs.response(responseCode.notFound, "USER DOES NOT EXIST", {}));

    let data = {
      user_id: req.body.user_id,
      type: req.body.type,
      purpose: req.body.purpose,
      description: req.body.description,
      currency: req.body.currency,
      quantity: req.body.quantity,
      rate: req.body.rate,
    };
    data.transfer_id = uuidv4();
    let apiPath = `${baseUrl}/v1/enterprise/transfer`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: data,
    });
    if (response.data) {
      const transfers = new Transfer({
        user_id: response.data.data.user_id,
        type: response.data.data.type,
        purpose: response.data.data.purpose,
        description: response.data.data.description,
        currency: response.data.data.currency,
        quantity: response.data.data.quantity,
        rate: response.data.data.rate,
        transfer_id: response.data.data.transfer_id,
        transfer_status_code: response.data.data.transfer_status_code,
        atx_id_charged: response.data.data.atx_id_charged,
        atx_id_credited: response.data.data.atx_id_credited,
        atx_status_charged: response.data.data.atx_status_charged,
        atx_status_credited: response.data.data.atx_status_credited,
        transfer_date: response.data.data.transfer_date,
      });
      let transferAdded = await transfers.save();
      if (transferAdded)
        return res
          .status(response.status)
          .json({ message: response.data.data });
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.confirmTransfer = async (req, res) => {
  try {
    let apiPath = `${baseUrl}/v1/enterprise/transfer/confirm`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: req.body,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.deleteTransfer = async (req, res) => {
  try {
    let transferId = req.params.transferId;
    let apiPath = `${baseUrl}/v1/enterprise/transfer/${transferId}`;
    await axios({
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

exports.transferStatus = async (req, res) => {
  try {
    let from_date = req.query.from_date;
    let to_date = req.query.to_date;
    let type = req.query.type;
    let purpose = req.query.purpose;
    let status = req.query.status;
    let apiPath = `${baseUrl}/v1/enterprise/transfer/history?${from_date}&${to_date}&${type}&${purpose}&${status}`;
    await axios({
      method: "post",
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

// Withdrawal

exports.withdrawal = async (req, res) => {
  try {
    const apiPath = `${baseUrl}/v1/user/withdraw/confirm`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      data: req.body,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    console.log("erroror", error);
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.resendWithdrawal = async (req, res) => {
  try {
    const apiPath = `${baseUrl}/v1/user/withdraw/resend-confirmation`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      data: req.body,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    console.log("erroror", error);
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.cancelWithdrawal = async (req, res) => {
  try {
    const apiPath = `${baseUrl}/v1/transactions/:${atx_id}`;
    await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    console.log("erroror", error);
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};


