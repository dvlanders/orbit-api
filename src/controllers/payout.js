const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

let userToken = process.env.USER_AUTH_TOKEN
let baseUrl = process.env.SFOX_BASE_URL
exports.withdrawal = async (req, res) => {
  try{
  const apiPath = `${baseUrl}/v1/user/withdraw/confirm`;
  let response = await axios({
    method: "post",
    url: apiPath,
    headers: {
      Authorization: "Bearer " + userToken,
    },
    data: req.body,
  })
  return res.status(response.status).json({message: response.data.data})
}catch(err){
      console.log("error", err);
      return res.status(err.response.status).send(err.response.data);
    };
};

exports.resendWithdrawal = async (req, res) => {
  try{
    const apiPath = `${baseUrl}/v1/user/withdraw/resend-confirmation`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      data: req.body,
    })
    return res.status(response.status).json({message: response.data.data})
  }catch(err) {
        console.log("error", err);
        return res.status(err.response.status).send(err.response.data);
  };
  };

  exports.cancelWithdrawal = async (req, res) => {
    try{
    const apiPath = `${baseUrl}/v1/transactions/:${atx_id}`;
    await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      
    })
    return res.status(response.status).json({message: response.data.data})
  }catch(err){
        console.log("error", err);
        return res.status(err.response.status).send(err.response.data);
  };
  };
  


