const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { responseCode, rs } = require("../util");
const User = require("./../models/userAuth");
const { common } = require("../util/helper");
const registration = require("./registration");
const speakeasy = require("speakeasy");
const payment = require("./payment");

let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;

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
    const { user_id } = req.params;
    const count = await User.scan().exec();
    var getUser = count.filter((item) => item.user_id == user_id);

    if (getUser.length == 0 || getUser[0].userToken == "") {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
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
    const { user_id } = req.params;
    const count = await User.scan().exec();
    var getUser = count.filter((item) => item.user_id == user_id);

    if (getUser.length == 0 || getUser[0].userToken == "") {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
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
    const { user_id } = req.params;
    const count = await User.scan().exec();
    var getUser = count.filter((item) => item.user_id == user_id);

    if (getUser.length == 0 || getUser[0].userToken == "") {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
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
    const { user_id } = req.params;
    const count = await User.scan().exec();
    var getUser = count.filter((item) => item.user_id == user_id);

    if (getUser.length == 0 || getUser[0].userToken == "") {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
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
    return res
      .status(response.status)
      .json({ message: "BANK ACCOUNT DELTED SUCCESSFULLY" });
  } catch (err) {
    return res.status(err.response?.status).send(err.response?.data);
  }
};

exports.wireInstructions = async (req, res) => {
  try {
    const { user_id } = req.params;
    const count = await User.scan().exec();
    var getUser = count.filter((item) => item.user_id == user_id);

    if (getUser.length == 0 || getUser[0].userToken == "") {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
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

exports.customer = async (req, res) => {
  try {
    const { user_id } = req.params;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let responseArr = [];
    let user = await registration.getUser();
    // userDetails.sfox_id == users.advisor_user_id
    let clientAccount = user.filter(
      (users) => users.account_type == "individual"
    );
    const count = await User.scan().exec();
    for (let i = 0; i < clientAccount.length; i++) {
      for (j = 0; j < count.length; j++) {
        if (clientAccount[i].user_id == count[j].sfox_id) {
          let response = {
            customer_id: count[j].user_id,
            name: count[j].fullName,
            email: count[j].email,
            walletAddress: null,
            created: count[j].createDate,
          };
          responseArr.push(response);
        }
      }
    }
    return res
      .status(responseCode.success)
      .json(rs.successResponse("CUSTOMERS RETRIVED", responseArr));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

(exports.customerDetails = async (req, res) => {
  try {
    const { user_id, customer_id } = req.params;
    const userDetails = await User.get(customer_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let paymentReq = { query: { type: "PAYMENT" } };
    let payments = await payment.transfer(paymentReq);
    let paymentData = [];
    for (let i = 0; i < payments.data.length; i++) {
      if (payments.data[i].user_id == userDetails.sfox_id) {
        paymentData.push(payments.data[i]);
      }
    }
    //'02d8a2bf-5d00-449c-8058-d0aba5147e57',

    let responseArr = [];
    let response = {
      name: userDetails.fullName,
      email: userDetails.email,
      spent: null,
      since: userDetails.createDate,
      MMR: null,
      paymentData: paymentData ? paymentData : null,
      currencyPaid: null,
      currencyReceived: null,
      exchangeRate: null,
      blockchainRecord: null,
      walletAddress: null,
      type: null,
      issuer: "Hifi Bridge",
      signatureCheck: null,
    };
    responseArr.push(response);
    return res
      .status(responseCode.success)
      .json(rs.successResponse("CUSTOMERS RETRIVED", responseArr));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
}),
  (exports.myAccount = async (req, res) => {
    try {
      const { user_id } = req.params;
      const userDetails = await User.get(user_id);
      if (userDetails == undefined) {
        common.eventBridge("USER NOT FOUND", responseCode.badRequest);
        return res
          .status(responseCode.badRequest)
          .json(rs.incorrectDetails("USER NOT FOUND", {}));
      }

      let response = {
        email: userDetails.email,
        name: userDetails.fullName,
        password: userDetails.password,
        twoStepAuthentication: "Authenticator app",
        accountName: userDetails.fullName,
        bussinessName: userDetails.businessName,
        timezone: userDetails.timezone
          ? userDetails.timezone
          : "America - New York",
      };
      return res
        .status(responseCode.success)
        .json(rs.successResponse("DATA RETRIVED", response));
    } catch (error) {
      return res
        .status(responseCode.serverError)
        .json(rs.errorResponse(error?.message.toString()));
    }
  });

// exports.phoneVerify = async(req,res) =>{
//   try{
//     const {phoneNumber} = req.body

//   }
//   catch(error){

//   }

// }

exports.dashboard = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { sales } = req.query;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    const customers = await User.scan().exec();
    let count = customers.length;
    let apiPath = `${baseUrl}/v1/quote`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
      data: { pair: "btcusd", side: "buy", quantity: 5 },
    });

    let paymentReq = { query: { type: "PAYMENT" } };
    let paymentData = await payment.transfer(paymentReq);

    let payoutReq = { query: { type: "PAYOUT" } };
    let payoutData = await payment.transfer(payoutReq);

    let responses = {
      totalPurchase: null,
      purchasePercentage: null,
      totalCustomers: count,
      customersPercentage: null,
      totalVolume: null,
      volumnePercentage: null,
      totalRevenue: null,
      revenuePercentage: null,
      totalSales: sales,
      paymentData: paymentData.data ? paymentData.data : null,
      payoutData: payoutData.data ? payoutData.data : null,
    };

    return res
      .status(responseCode.success)
      .json(rs.successResponse("DATA RETRIVED", responses));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};
