const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const dynamodb = require("./../config/dynamodb");
const User = require("./../models/userAuth");
const { responseCode, rs } = require("../util");

/**
 *
 * @description This is the sFox Registration API
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.register = async (req, res) => {
  try {
    let data = req.body;

    const userDetails = await User.scan().where("email").eq(data?.email).exec();

    if (userDetails?.count === 0)
      return res
        .status(responseCode.notFound)
        .json(rs.response(responseCode.notFound, "USER DOES NOT EXIST", {}));

    data.user_id = uuidv4();
    const apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/register-account`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
      },
      data: data,
    });

    return res
      .status(responseCode.success)
      .json(rs.successResponse("USER REGISTERED", response.data.data));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .send(rs.errorResponse(error.response.data));
  }
};

exports.requestOTP = async (req, res) => {
  try {
    let userId = req.params.userId;
    const apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/users/send-verification/${userId}`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
      },
      data: req.body,
    });

    return res
      .status(responseCode.success)
      .json(rs.successResponse("OTP REQUESTED", response.data.data));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error.response.data));
  }
};

exports.verify = async (req, res) => {
  try {
    let userId = req.params.userId;
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/users/verify/${userId}`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
      },
      data: req.body,
    });
    return res
      .status(responseCode.success)
      .json(rs.successResponse("OTP VERIFIED", response.data.data));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error.response.data));
  }
};

exports.userToken = async (req, res) => {
  try {
    let patnerUserId = req.params.patneruserId;
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/user-tokens/${patnerUserId}`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
      },
    });
    return res
      .status(responseCode.success)
      .json(rs.successResponse("TOKEN RETRIEVED", response.data.data));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error.response.data));
  }
};
