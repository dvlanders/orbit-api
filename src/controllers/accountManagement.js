const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { responseCode, rs } = require("../util");
const User = require("./../models/userAuth");
const { common } = require("../util/helper");
const registration = require("./registration");
const payment = require("./payment");
const { response } = require("../util/ResponseTemplate");
const bankAccountSchema = require("./../models/bankAccounts");

let baseUrl = process.env.SFOX_BASE_URL;

exports.linkBank = async (req, res) => {
  try {
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

    const { user_id } = req.params;

    if (!user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER THE USER ID", {}));
    }

    const userDetails = await User.get(user_id);
    console.log(userDetails);

    if (userDetails == undefined) {
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
        Authorization: "Bearer " + userDetails.userToken,
      },
      data: data,
    });
    let saveBank;
    if (response.data.usd.length > 0) {
      const myBank = new bankAccountSchema({
        id: response.data.usd[0].id,
        user_id: user_id,
        status: response.data.usd[0].status,
        requires_verification: response.data.usd[0].requires_verification,
        requires_support: response.data.usd[0].requires_support,
        routing_number: response.data.usd[0].routing_number,
        account_number: response.data.usd[0].account_number,
        name1: response.data.usd[0].name1,
        currency: response.data.usd[0].currency,
        type: response.data.usd[0].type,
        bank_name: response.data.usd[0].bank_name,
        ach_enabled: response.data.usd[0].ach_enabled,
        international_bank: response.data.usd[0].isInternational,
        ref_id: response.data.usd[0].ref_id,
        wire_withdrawal_fee: response.data.usd[0].wire_withdrawal_fee,
        verifiedStatus: "Pending",
        verificationSent : false,
        
      });
      saveBank = await myBank.save();
    }
    if (saveBank) {
      let responses =  saveBank

      return res
        .status(responseCode.success)
        .json(rs.successResponse("Bank Linked", responses));
    } else {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("BANK ACCOUNT NOT SAVED", {}));
    }
  } catch (err) {
    console.log("error", err);
    return res
      .status(err?.response?.status || 500 )
      .json({ error: err?.response?.data?.error });
  }
};

exports.verifyBank = async (req, res) => {
  try {
    const { user_id, bank_id } = req.params;
    // const { verifyAmount1, verifyAmount2 } = req.body;

    if (!user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER THE USER ID", {}));
    }

    const userDetails = await User.get(user_id);
    console.log(userDetails);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    // await bankAccountSchema

    // let apiPath = `${baseUrl}/v1/user/bank/verify`;
    // let response = await axios({
    //   method: "post",
    //   url: apiPath,
    //   headers: {
    //     Authorization: "Bearer " + getUser[0].userToken,
    //   },
    //   data: {
    //     verifyAmount1 : 0.02,
    //     verifyAmount2 : 0.03
    //   },
    // });
    let verifyBank;
    // if(response.data) {
    verifyBank = await bankAccountSchema.update(
      { user_id: user_id , id : bank_id},
      {verificationSent : true, verifiedStatus : "Success"}
    );
    // }
    return res.status(response.status || 200).json({ message: verifyBank });
  } catch (err) {
    return res.status(err?.response?.status || 500).send(err.response?.data);
  }
};

exports.getBank = async (req, res) => {
  try {
    const { user_id, bank_id } = req.params;

    if (!user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER THE USER ID", {}));
    }

    const userDetails = await User.get(user_id);
    // console.log(userDetails);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let getABank =  await bankAccountSchema.scan().where("user_id").eq(user_id).where("id").eq(bank_id).exec();
    return res.status(responseCode.success).json(rs.successResponse("BANK DATA RETRIVED", getABank ));
  } catch (err) {
    return res.status(responseCode.serverError).send(rs.serverError("BANK ACCOUNT NOT SAVED", err));
  }
};

exports.getAllBank = async (req, res) => {
  try {
    const { user_id} = req.params;

    if (!user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER THE USER ID", {}));
    }

    const userDetails = await User.get(user_id);
    // console.log(userDetails);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let getAllBank =  await bankAccountSchema.scan().where("user_id").eq(user_id).exec();
    return res.status(responseCode.success).json(rs.successResponse("ALL BANK DATA RETRIVED",getAllBank));
  } catch (err) {
    return res.status(responseCode.serverError).send(rs.serverError("BANK ACCOUNT NOT SAVED", err));
  }
};



exports.deleteBank = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER THE USER ID", {}));
    }

    const userDetails = await User.get(user_id);
    console.log(userDetails);

    if (userDetails == undefined) {
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
        Authorization: "Bearer " + userDetails.userToken,
      },
    });
    let deleteAccount;
    if (response.status == 200) {
      deleteAccount = await bankAccountSchema.update(
        { user_id: userDetails.user_id },
        { status: "Inactive" }
      );
    }
    if (deleteAccount) {
      return res
        .status(response.status)
        .json({ message: "BANK ACCOUNT DELTED SUCCESSFULLY" });
    } else {
      return res.status(500).json({ error: "ERROR IN DELETING BANK ACCOUNT" });
    }
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
    if (res) {
      return res.status(response.status).json({ message: response.data.data });
    } else {
      return response.data.data;
    }
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

exports.customerDetails = async (req, res) => {
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
};

exports.myAccount = async (req, res) => {
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
};

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
    let count = customers.count;
    let apiPath = `${baseUrl}/v1/quote`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
      data: { pair: "btcusd", side: "buy", quantity: 5 },
    });
    let refund = 0;
    let monetization = 0;
    let adjustments = 0;

    let paymentReq = {query: {type :  "PAYMENT"}}
    let paymentData = await payment.transfer(paymentReq);
    let totalRev = 0
    // for(let i=0;i<paymentData.data.length;i++){
      // totalRev = totalRev +  (paymentData.data[i].quantity * paymentData.data[i].rate) - refund - monetization - adjustments ;
      // const dateString = paymentData.data[i].transfer_date;
      // const date = new Date(dateString);
      // let  getMonth = date.getUTCMonth() + 1
      
      monthData = []
      let month = 1
      for (let i=0;i<paymentData.data.length;i++){
        totalRev = totalRev +  (paymentData.data[i].quantity * paymentData.data[i].rate) - refund - monetization - adjustments ;
      }  
      while(month<13){
    let total = 0
    for (let i=0;i<paymentData.data.length;i++){
      const dateString = paymentData.data[i].transfer_date;
      const date = new Date(dateString);
      let  getMonth = date.getUTCMonth() + 1
        if(getMonth == month){
            total = total + (paymentData.data[i].quantity * paymentData.data[i].rate) - refund - monetization - adjustments
        }
      }
      monthData.push({ month: month, totalAmount: total });
      month = month + 1;
    }
    let payoutReq = { query: { type: "PAYOUT" } };
    let payoutData = await payment.transfer(payoutReq);

    let responses = {
      "totalPurchase":paymentData.count ? paymentData.count : null,
      "purchasePercentage": null,
      "totalCustomers":count,
      "customersPercentage" : null,
      "totalRevenue":totalRev ? totalRev : 0,
      "montlyRevenue" :monthData,
      "revenuePercentage" : null,
      "totalSales":sales,
      "paymentData" : paymentData.data ? paymentData.data : null,
      "payoutData" : payoutData.data ? payoutData.data : null,
    }

    return res
      .status(responseCode.success)
      .json(rs.successResponse("DATA RETRIVED", responses));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};
