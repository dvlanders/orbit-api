const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

let userToken 
exports.withdrawal = async (req, res) => {
  
  const apiPath = "https://api.staging.sfox.com/v1/user/withdraw/confirm";
  await axios({
    method: "post",
    url: apiPath,
    headers: {
      Authorization: "Bearer " + userToken,
    },
    data: req.body,
  })
    .then((response) => {
      return res.status(response.status).send(response.data);
    })
    .catch((err) => {
      console.log("error", err);
      return res.status(err.response.status).send(err.response.data);
    });
};

exports.resendWithdrawal = async (req, res) => {
  
    const apiPath = "https://api.staging.sfox.com/v1/user/withdraw/resend-confirmation";
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      data: req.body,
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        console.log("error", err);
        return res.status(err.response.status).send(err.response.data);
      });
  };

  exports.cancelWithdrawal = async (req, res) => {
  
    const apiPath = `https://api.staging.sfox.com/v1/transactions/:${atx_id}`;
    await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        console.log("error", err);
        return res.status(err.response.status).send(err.response.data);
      });
  };
  


