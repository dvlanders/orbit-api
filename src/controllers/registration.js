const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const dynamodb = require("./../config/dynamodb");
const User = require("./../models/userAuth");

let token = process.env.SFOX_ENTERPRISE_API_KEY;
let baseUrl = process.env.SFOX_BASE_URL;

exports.register = async (req, res) => {
  try {
    let data = req.body;
    data.user_id = uuidv4();
    const apiPath = `${baseUrl}/v1/enterprise/register-account`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: data,
    });
    // let  input = {
    //     "user_id" : register.data.data.user_id,
    //     "created_by": "clientUser",
    //     "created_on": new Date().toString(),
    //     "updated_by": "clientUser",
    //     "updated_on": new Date().toString(), "is_deleted": false,
    //     "auth_token"  : "",
    // };
    // var params = {
    //     TableName: "user_auth",
    //     Item:  input
    // };
    // let save = dynamodb.put(params)

    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    return res.status(400).send(error.response.data);
  }
};

exports.requestOTP = async (req, res) => {
  try {
    let userId = req.params.userId;
    let apiPath = `${baseUrl}/v1/enterprise/users/send-verification/${userId}`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: req.body,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (err) {
    return res.status(err.response.status).send(err.response.data);
  }
};

exports.verify = async (req, res) => {
  try {
    let userId = req.params.userId;
    let apiPath = `${baseUrl}/v1/enterprise/users/verify/${userId}`;
    // let data = {
    //   type: "email",
    //   otp: "192953",
    // };
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: req.body,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (err) {
    return res.status(err.response.status).send(err.response.data);
  }
};

exports.userToken = async (req, res) => {
  try {
    let patnerUserId = req.params.patneruserId;
    let apiPath = `${baseUrl}/v1/enterprise/user-tokens/${patnerUserId}`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    //   const myUser = new db({
    //     "id": patnerUserId,
    //     "userToken": response.data.token
    // });
    // try {
    //     await myUser.save();
    //     let see = await myUser.get();
    //     console.log("Save operation was successful.", );
    // } catch (error) {
    //     console.error(error);
    // }
    return res.status(response.status).json({ message: response.data.data });
  } catch (err) {
    return res.status(err.response.status).json({ message: err.response.data });
  }
};
