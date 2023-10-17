const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

let userToken = process.env.USER_AUTH_TOKEN;
let baseUrl = process.env.SFOX_BASE_URL;

let token = process.env.SFOX_ENTERPRISE_API_KEY;
exports.linkBank = async (req, res) => {
  let data = {
    accountnumber: req.body.accountnumber,
    bankAccountType: req.body.bankAccountType,
    bankCurrency: req.body.bankCurrency,
    bankname : req.body.bankname,
    enableWires: req.body.enableWires,
    isInternational: req.body.isInternational,
    routingnumber: req.body.routingnumber,
    type: req.body.type,
    wireRoutingnumber: req.body.wireRoutingnumber,
  };
  try {
    const apiPath = `${baseUrl}/v1/user/bank`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      data: data,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (err) {
    console.log("error", err);
    return res
      .status(err.response.status)
      .json({ error: err.response.data.error });
  }
};

exports.verifyBank = async (req, res) => {
  try {
    let data = {
      verifyAmount1: req.body.verifyAmount1,
      verifyAmount2: req.body.verifyAmount2,
    };
    let apiPath = `${baseUrl}/v1/user/bank/verify`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      data: data,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (err) {
    return res.status(err.response.status).send(err.response.data);
  }
};

exports.getBank = async (req, res) => {
  try {
    let apiPath = `${baseUrl}/v1/user/bank`;
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

exports.deleteBank = async (req, res) => {
  try {
    let apiPath = `${baseUrl}/v1/user/bank`;
    let response = await axios({
      method: "delete",
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

exports.wireInstructions = async (req, res) => {
  try {
    let apiPath = `${baseUrl}/v1/user/wire-instructions`;
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
