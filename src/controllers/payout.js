const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("./../models/transfer");
const User = require("./../models/userAuth");
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
const { sendEmail, common } = require("../util/helper");
const { responseCode, rs } = require("../util");

//Transfer

exports.createTransfer = async (req, res) => {
  try {
    const { cuser_id: customer_user_id } = req.params;

    console.log(customer_user_id);

    if (!customer_user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }
    console.log(req?.body?.quantity);
    if (!(req?.body?.quantity >= 11))
      return res
        .status(responseCode.badRequest)
        .json(
          rs.incorrectDetails(
            "QUANTITY MUST BE GREATER THAN OR EQUAL TO 11",
            {}
          )
        );

    const userDetails = await User.get(customer_user_id);
    console.log(userDetails);

    if (userDetails == undefined) {
      common.eventBridge("CUSTOMER USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("CUSTOMER USER NOT FOUND", {}));
    }

    let data = {
      type: req.body.type,
      purpose: req.body.purpose,
      description: req.body.description,
      currency: req.body.currency,
      quantity: req.body.quantity,
      rate: req.body.rate,
    };

    data.user_id = userDetails.sfox_id;

    console.log(data);

    data.transfer_id = uuidv4();

    let apiPath = `${baseUrl}/v1/enterprise/transfer`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + process.env.SFOX_ENTERPRISE_API_KEY,
      },
      data: data,
    });
    if (response.data) {
      const transfers = new Transfer({
        user_id: customer_user_id,
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
          .status(200)
          .json(rs.successResponse("TRANSFER", response?.data?.data));
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(500).send(error?.response?.data);
  }
};

exports.confirmTransferPayment = async (req, res) => {
  try {
    const { user_id, transfer_id } = req.params;
    const { otp } = req.body;

    if (!user_id || !transfer_id || !otp) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    const userDetails = await User.get(user_id);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let isTransfer = await Transfer.scan()
      .where("transfer_id")
      .eq(transfer_id)
      .where("user_id")
      .eq(user_id)
      .exec();

    console.log(isTransfer?.count == 0);
    if (isTransfer?.count === 0)
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("TRANSFER NOT FOUND", {}));

    if (isTransfer[0].transfer_status_code == "COMPLETE")
      return res
        .status(200)
        .json(rs.successResponse("PAYMENT IS ALREADY VERIFIED"));

    let apiPath = `${baseUrl}/v1/enterprise/transfer/confirm`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: {
        transfer_id,
        otp,
      },
    });

    let isupdated = await Transfer.update(
      { transfer_id: transfer_id },
      { transfer_status_code: "COMPLETE" }
    );

    return res
      .status(responseCode.success)
      .json(rs.successResponse("VERIFIED OTP"));
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(error?.response?.status)
      .json(rs.errorResponse(error.response.data, error?.response?.status));
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
    return res.status(error.response?.status).send(error.response.data);
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
    return res.status(error.response?.status).send(error.response.data);
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
    return res.status(error.response?.status).send(error.response.data);
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
    return res.status(error.response?.status).send(error.response.data);
  }
};
