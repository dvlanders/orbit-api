const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const dynamodb = require("./../config/dynamodb");
const User = require("./../models/userAuth");
const { responseCode, rs } = require("../util");
const {common } = require("../util/helper");
const cron = require('cron');




let token = process.env.SFOX_ENTERPRISE_API_KEY;
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
        .json(rs.response(responseCode.notFound, "USER DOES NOT EXIST ", {}));

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
    console.log(data.user_id);

    let update_client_userid = await User.update(
      { user_id: userDetails[0].user_id },
      { sfox_id: data.user_id }
    );

    // console.log(update_client_userid);

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
    const userDetails = await User.scan().where("user_id").eq(userId).exec();
    console.log(userDetails);

    if (userDetails?.count === 0)
      return res
        .status(responseCode.notFound)
        .json(rs.response(responseCode.notFound, "USER DOES NOT EXIST", {}));

    if (userDetails[0].sfox_id.length === 0)
      return res
        .status(responseCode.notFound)
        .json(
          rs.response(
            responseCode.notFound,
            "PLEASE REGISTER WITH MERCHANT FIRST",
            {}
          )
        );

    const apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/users/send-verification/${userDetails[0].sfox_id}`;
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
    console.log(error);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse({ message: error }));
  }
};

exports.verify = async (req, res) => {
  try {
    let userId = req.params.userId;

    const userDetails = await User.scan().where("user_id").eq(userId).exec();
    console.log(userDetails);

    if (userDetails?.count === 0)
      return res
        .status(responseCode.notFound)
        .json(rs.response(responseCode.notFound, "USER DOES NOT EXIST", {}));

    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/users/verify/${userDetails[0].sfox_id}`;
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
      .json(rs.errorResponse({ message: error }));
  }
};

exports.userToken = async (req, res) => {
  try {
    let userId = req.params.userId;

    const userDetails = await User.scan().where("user_id").eq(userId).exec();
    console.log(userDetails);

    if (userDetails?.count === 0)
      return res
        .status(responseCode.notFound)
        .json(rs.response(responseCode.notFound, "USER DOES NOT EXIST", {}));

    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/user-tokens/${userDetails[0].sfox_id}`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
      },
    });
    

    // console.log(response?.data?.data);
    let update_user_authtoken = await User.update(
      { user_id: userDetails[0].user_id },
      { userToken: response?.data?.data?.token }
    );

    return res
      .status(responseCode.success)
      .json(rs.successResponse("TOKEN RETRIEVED", response.data.data));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse({ message: error }));
  }
};

exports.deleteUser = async (req, res) => {
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
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/account/${getUser[0].sfox_id}`;
    let response = await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return res.status(response.status).json({ message: `USER IS DELETED SUCCESSFULLLY ` });
  } catch (err) {
    return res.status(err.response?.status).send(err.response?.data);
  }
};



