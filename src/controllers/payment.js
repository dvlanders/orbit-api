const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

let uuid = uuidv4();
let token = process.env.SFOX_ENTERPRISE_API_KEY;

let userToken = process.env.USER_AUTH_TOKEN
let baseUrl = process.env.SFOX_BASE_URL

exports.monetization = async (req, res) => {
  try{
    const { feature, method, amount, user_id} = req.body
    let apiPath = `${baseUrl}/v1/enterprise/monetization/settings`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: {
      "feature" : feature,
      "amount" : amount,
      "method" : method,
      "user_id" : user_id
      }
    })
    return res.status(response.status).json({message: response.data.data})
    }catch(err) {
    return res.status(err.response.status).send(err.response.data);
  };
};

exports.updateMonetization = async (req, res) => {
  try{
    let apiPath = `${baseUrl}/v1/enterprise/monetization/settings/:${monetization_id}`;
    let response = await axios({
      method: "patch",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: {
        new_monetization_amount: req.body.new_monetization_amount
      }
    })
    return res.status(response.status).json({message: response.data.data})
      }catch(err){
        return res.status(err.response.status).send(err.response.data);
      };
};

exports.deleteMonetization = async (req, res) => {
  try{
    let apiPath = `${baseUrl}/v1/enterprise/monetization/settings/:${monetization_id}`;
    let response = await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    })
    return res.status(response.status).json({message: response.data.data})
    }catch(err){
      return res.status(err.response.status).send(err.response.data);
    };
};

exports.monetizationHistory = async (req, res) => {
  try{
    let apiPath = `${baseUrl}/v1/enterprise/monetization/history?${feature}`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    })
    return res.status(response.status).json({message: response.data.data})
  }catch(err) {
        return res.status(err.response.status).send(err.response.data);
  };
};


exports.transfer = async (req, res) => {
  try{
    let data = req.body;
  data.transfer_id = uuid;
    let apiPath = `${baseUrl}/v1/enterprise/transfer`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: req.body,
    })
    return res.status(response.status).json({message: response.data.data})
    }catch(err){
        return res.status(err.response.status).send(err.response.data);
    }
};


exports.confirmTransfer = async (req, res) => {
  try{
    let apiPath = `${baseUrl}/v1/enterprise/transfer/confirm`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: req.body,
    })
    return res.status(response.status).json({message: response.data.data})
    }catch(err){
        return res.status(err.response.status).send(err.response.data);
    };
};

exports.deleteTransfer = async (req, res) => {
  try{
    let transferId = req.params.transferId
    let apiPath = `${baseUrl}/v1/enterprise/transfer/${transferId}`;
    await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    })
    return res.status(response.status).json({message: response.data.data})
  }catch(err){
        return res.status(err.response.status).send(err.response.data);
  };
};


exports.transferStatus = async (req, res) => {
  try{
    let from_date = req.query.from_date
    let to_date = req.query.to_date
    let type = req.query.type
    let purpose = req.query.purpose
    let status = req.query.status
    let apiPath = `${baseUrl}/v1/enterprise/transfer/history?${from_date}&${to_date}&${type}&${purpose}&${status}`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    })
    return res.status(response.status).json({message: response.data.data})
  }catch(err){
        return res.status(err.response.status).send(err.response.data);
  };
};




