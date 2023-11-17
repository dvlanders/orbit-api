const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { responseCode, rs } = require("../util");
const User = require("./../models/userAuth");
const { common } = require("../util/helper");
const registration = require("./registration");
const payment = require("./payment");
const { response } = require("../util/ResponseTemplate");
const CustomerWalletAddress = require("../models/customerWalletAddress");
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
        verificationSent: false,
      });
      saveBank = await myBank.save();
    }
    if (saveBank) {
      let responses = saveBank;

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
      .status(err?.response?.status || 500)
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
      { user_id: user_id, id: bank_id },
      { verificationSent: true, verifiedStatus: "Success" }
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

    if (!user_id || !bank_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    const userDetails = await User.get(user_id);
    // console.log(userDetails);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let getABank = await bankAccountSchema
      .scan()
      .where("user_id")
      .eq(user_id)
      .where("id")
      .eq(bank_id)
      .exec();

    return res
      .status(responseCode.success)
      .json(rs.successResponse("BANK DATA RETRIVED", getABank[0]));
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .send(rs.serverError("BANK ACCOUNT NOT SAVED", err));
  }
};

exports.getAllBank = async (req, res) => {
  try {
    const { user_id } = req.params;

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

    let getAllBank = await bankAccountSchema
      .scan()
      .where("user_id")
      .eq(user_id)
      .exec();
    return res
      .status(responseCode.success)
      .json(rs.successResponse("ALL BANK DATA RETRIEVED", getAllBank));
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .send(rs.serverError("BANK ACCOUNT NOT SAVED", err));
  }
};

exports.deleteBank = async (req, res) => {
  try {
    const { user_id, bank_id } = req.params;

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
        { user_id: user_id, id: bank_id },
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
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/user/wire-instructions`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + req.user["userToken"],
      },
    });
    if (response?.data?.data) {
      return res
        .status(response.status)
        .json(
          rs.successResponse(
            "WIRE INSTRUCTIONS RETREIVED",
            response?.data?.data
          )
        );
    } else {
      return res
        .status(response.status)
        .json(rs.successResponse("WIRE INSTRUCTIONS RETREIVED", {}));
    }
  } catch (err) {
    return res.status(err.response?.status).send(err.response?.data);
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

    let refund = 0;
    let monetization = 0;
    let adjustments = 0;

    let paymentReq = { params: { user_id: user_id } };
    let paymentData = await payment.transaction(paymentReq);
    let totalRev = 0;
    // for(let i=0;i<paymentData.data.length;i++){
    // totalRev = totalRev +  (paymentData.data[i].quantity * paymentData.data[i].rate) - refund - monetization - adjustments ;
    // const dateString = paymentData.data[i].transfer_date;
    // const date = new Date(dateString);
    // let  getMonth = date.getUTCMonth() + 1

    monthData = [];
    let month = 1;
    for (let i = 0; i < paymentData.length; i++) {
      totalRev =
        totalRev + paymentData[i].amount - refund - monetization - adjustments;
    }
    while (month < 31) {
      let total = 0;
      for (let i = 0; i < paymentData.length; i++) {
        const dateString = paymentData[i].date;
        const date = new Date(dateString);
        let getMonth = date.getDate();
        let onlymon = date.getUTCMonth() + 1;

        if (getMonth == month) {
          total =
            total + paymentData[i].amount - refund - monetization - adjustments;
        }
      }
      if (total != 0)
        monthData.push({
          day: month,
          totalAmount: total.toFixed(2),
          month: 11,
        });
      month = month + 1;
    }

    monthPurchase = [];
    let mon = 1;
    while (mon < 31) {
      let totals = 0;
      for (let i = 0; i < paymentData.length; i++) {
        const dateString = paymentData[i].date;
        const date = new Date(dateString);
        let getMonth = date.getDate();
        //date.getUTCMonth() + 1;
        if (getMonth == mon) {
          let purchaseLength = [];
          purchaseLength.push(paymentData[i]);

          totals = totals + purchaseLength.length;
        }
      }
      if (totals != 0)
        monthPurchase.push({ day: mon, purchase: totals, month: 11 });
      mon = mon + 1;
    }

    let totalCustomers = await CustomerWalletAddress.scan()
      .where("user_id")
      .eq(user_id)
      .exec();

    let customerCurrency = "";
    let monthlyCustomer = [];
    let customerCurrenc = [];
    let months = 1;
    while (months < 31) {
      let totalCus = 0;

      for (let i = 0; i < totalCustomers.length; i++) {
        const dateString = totalCustomers[i].createDate;
        const date = new Date(dateString);
        let getMonths = date.getDate();
        let onlymon = date.getUTCMonth() + 1;

        if (getMonths == months) {
          customerCurrency = customerCurrency + totalCustomers[i].currency;
          let customerLength = [];
          customerLength.push(totalCustomers[i]);

          totalCus = totalCus + customerLength.length;
        }
      }
      if (totalCus != 0)
        customerCurrenc.push({
          day: months,
          currency: customerCurrency,
          month: 11,
        });

      monthlyCustomer.push({
        day: months,
        customers: totalCus,
        month: 11,
      });
      months = months + 1;
    }

    let responses = {
      totalPurchase: paymentData.length ? paymentData.length : 0,
      monthlyPurchase: monthPurchase ? monthPurchase : 0,
      purchasePercentage: null,
      totalCustomers: totalCustomers.count,
      monthlyCustomers: monthlyCustomer,
      customersPercentage: null,
      totalRevenue: totalRev ? totalRev : 0,
      monthlyRevenue: monthData,
      revenuePercentage: null,
      totalSales: customerCurrenc ? customerCurrenc : null,
      paymentData: paymentData ? paymentData : null,
      payoutData: null,
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

exports.addTeam = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { email, admin_role, developer_role, identity_role, connect_role } =
      req.body;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let mailDetails = {
      from: `${process.env.FROM_EMAIL}`,
      to: email,
      subject: "Registration Form",
      text: `Please fill up the google form, with the following role i.e  admin_role, developer_role, identity_role, connect_role \n ${process.env.REGISTER_FORM_LINK}`,
    };
    generate = await sendEmail.generateEmail(mailDetails); //Generate Email
    if (!generate.messageId) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("WRONG EMAIL ID", {}));
    }
    const myUser = new User({
      user_id: uuidv4(),
      email: email,
      phoneNumber: "",
      fullName: "",
      businessName: "",
      password: "",
      userToken: "",
      secretkey: "",
      isVerified: false,
      timeZone: timeZone,
    });
    let user = await myUser.save();
    if (user)
      return res
        .status(responseCode.success)
        .json(rs.successResponse("DATA RETRIVED", "Invitation send"));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

exports.team = async (req, res) => {
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
