const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

let uuid = uuidv4();
let token = process.env.SFOX_ENTERPRISE_API_KEY;

let userToken = "f0d3dfe286648094aecf909ff954865a26b99b5ad3cf7d00142a25c87eeb3248"

exports.linkBank = async (req, res) => {
  let data = req.body;
  data.user_id = uuid;
  const apiPath = "https://api.staging.sfox.com/v1/user/bank";
  await axios({
    method: "post",
    url: apiPath,
    headers: {
      Authorization: "Bearer " + userToken,
    },
    data: data,
  })
    .then((response) => {
      return res.status(response.status).send(response.data);
    })
    .catch((err) => {
      console.log("error", err);
      return res.status(err.response.status).send(err.response.data);
    });
};

exports.verifyBank = async (req, res) => {
  let apiPath = `https://api.staging.sfox.com/v1/user/bank/verify`;
  await axios({
    method: "post",
    url: apiPath,
    headers: {
      Authorization: "Bearer " + userToken,
    },
    data: req.body,
  })
    .then((response) => {
      console.log("res",response)
      return res.status(response.status).send(response.data);
    })
    .catch((err) => {
      return res.status(err.response.status).send(err.response.data);
    });
};

exports.getBank = async (req, res) => {
  let apiPath = `https://api.staging.sfox.com/v1/user/bank`;
  await axios({
    method: "get",
    url: apiPath,
    headers: {
      Authorization: "Bearer " + userToken,
    },
    
  })
    .then((response) => {
      return res.status(response.status).send(response.data);
    })
    .catch((err) => {
      return res.status(err.response.status).send(err.response.data);
    });
};

exports.deleteBank = async (req, res) => {
    let apiPath = `https://api.staging.sfox.com/v1/user/bank`;
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
        return res.status(err.response.status).send(err.response.data);
      });
  };

  exports.wireInstructions = async (req, res) => {
    let apiPath = `https://api.staging.sfox.com/v1/user/wire-instructions`;
    await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
  };



exports.monetization = async (req, res) => {
    const { feature, method, amount, user_id} = req.body
    let apiPath = `https://api.staging.sfox.com/v1/enterprise/monetization/settings`;
    await axios({
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
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
};

exports.updateMonetization = async (req, res) => {
    
    let apiPath = `https://api.staging.sfox.com/v1/enterprise/monetization/settings/:${monetization_id}`;
    await axios({
      method: "patch",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: {
        new_monetization_amount: req.body.new_monetization_amount
      }
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
};

exports.deleteMonetization = async (req, res) => {
    let apiPath = `https://api.staging.sfox.com/v1/enterprise/monetization/settings/:${monetization_id}`;
    await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
};

exports.monetizationHistory = async (req, res) => {
    let apiPath = `https://api.staging.sfox.com/v1/enterprise/monetization/history?${feature}`;
    await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
};


exports.transfer = async (req, res) => {
    let data = req.body;
  data.transfer_id = uuid;
    let apiPath = `https://api.staging.sfox.com/v1/enterprise/transfer`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: req.body,
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
};


exports.confirmTransfer = async (req, res) => {
    let apiPath = `https://api.staging.sfox.com/v1/enterprise/transfer/confirm`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: req.body,
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
};

exports.deleteTransfer = async (req, res) => {
    let transferId = req.params.transferId
    let apiPath = `https://api.staging.sfox.com/v1/enterprise/transfer/${transferId}`;
    await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
};


exports.transferStatus = async (req, res) => {
    let from_date = req.query.from_date
    let to_date = req.query.to_date
    let type = req.query.type
    let purpose = req.query.purpose
    let status = req.query.status
    let apiPath = `https://api.staging.sfox.com/v1/enterprise/transfer/history?${from_date}&${to_date}&${type}&${purpose}&${status}`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => {
        return res.status(response.status).send(response.data);
      })
      .catch((err) => {
        return res.status(err.response.status).send(err.response.data);
      });
};




