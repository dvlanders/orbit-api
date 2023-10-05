const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

let uuid = uuidv4();
let token = process.env.SFOX_ENTERPRISE_API_KEY;

let userToken = process.env.USER_AUTH_TOKEN
let baseUrl = process.env.SFOX_BASE_URL

exports.transactions = async (req, res) => {
  try{
    let query 
    if(req.query){
      query = {
          from: req.query,
          to: req.query,
          limit: req.query,
          offset : req.query,
          types : req.query
         }
    }
    else{
      query = ""
    }
    let apiPath = `${baseUrl}/v1/account/transactions`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      params: query
  })
    return res.status(response.status).json({message: response.data.data})
    }catch(err){
      return res.status(err.response.status).send(err.response.data);
    };
};
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


