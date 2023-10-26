const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { responseCode, rs } = require("../util");
const User = require("./../models/userAuth");
const {common } = require("../util/helper");
const registration = require("./registration")

let baseUrl = process.env.SFOX_BASE_URL;


exports.linkBank = async (req, res) => {
  
    let data = {
      accountnumber: req.body.accountnumber,
      bankAccountType: req.body.bankAccountType,
      bankCurrency: req.body.bankCurrency,
      bankname: req.body.bankname,
      enableWires: req.body.enableWires,
      firstname: req.body.firstname,
      isInternational: req.body.isInternational,
      lastname: req.body.lastname,
      name: req.body.name,
      swiftnumber: req.body.swiftnumber,
      type: req.body.type,
      wireInstructions: req.body.wireInstructions,
    };

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
    const apiPath = `${baseUrl}/v1/user/bank`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + getUser[0].userToken,
      },
      data: data,
    });
    return res
    .status(responseCode.success)
    .json(rs.successResponse("Bank Linked", response?.data));
  } catch (err) {
    console.log("error", err);
    return res
      .status(err.response?.status)
      .json({ error: err.response?.data?.error });
  }
};

exports.verifyBank = async (req, res) => {
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
    let data = {
      amount1: req.body.verifyAmount1,
      amount2: req.body.verifyAmount2,
    };
    let apiPath = `${baseUrl}/v1/user/bank/verify`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + getUser[0].userToken,
      },
      data: data,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (err) {
    return res.status(err.response?.status).send(err.response?.data);
  }
};

exports.getBank = async (req, res) => {
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
    let apiPath = `${baseUrl}/v1/user/bank`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + getUser[0].userToken,
      },
    });
    return res.status(response.status).json({ message: response.data });
  } catch (err) {
    return res.status(err.response?.status).send(err.response?.data);
  }
};

exports.deleteBank = async (req, res) => {
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
    let apiPath = `${baseUrl}/v1/user/bank`;
    let response = await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + getUser[0].userToken,
      },
    });
    return res.status(response.status).json({ message: "BANK ACCOUNT DELTED SUCCESSFULLY"});
  } catch (err) {
    return res.status(err.response?.status).send(err.response?.data);
  }
};

exports.wireInstructions = async (req, res) => {
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
    let apiPath = `${baseUrl}/v1/user/wire-instructions`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + getUser[0].userToken,
      },
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (err) {
    return res.status(err.response?.status).send(err.response?.data);
  }
};



exports.customer = async(req,res) => {
  try{
    // let user = registration.getUser;
    const count = await User.scan().exec();

    let responseArr =[]
    for(let i=0; i<count.length; i++){
      let response = {
        "name" : count[i].fullName,
        "email": count[i].email,
        "walletAddress" : null,
        "created" : count[i].createDate
      }
      responseArr.push(response)
    }
    return res
    .status(responseCode.success)
    .json(
      rs.successResponse("CUSTOMERS RETRIVED", { data : responseArr})
    );
  }
  catch(error){
    return res
    .status(responseCode.serverError)
    .json(rs.errorResponse(error?.message.toString()));
  }


}