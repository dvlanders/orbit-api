const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { responseCode, rs } = require("../util");
const User = require("./../models/userAuth");
const { sendEmail, common } = require("../util/helper");
const registration = require("./registration");
const CustomerWalletAddress = require("../models/customerWalletAddress");
const bankAccountSchema = require("./../models/bankAccounts");
const TransactionLog = require("../models/transactionLog");
const moment = require("moment");
const momentTZ = require("moment-timezone");

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

    let getBanks = await bankAccountSchema
      .scan()
      .where("user_id")
      .eq(req.user["id"])
      .exec();

    if (getBanks?.count > 0) {
      return res
        .status(responseCode.conflict)
        .json(rs.conflict("ONE BANK ACCOUNT LINKED - "));
    }

    const apiPath = `${baseUrl}/v1/user/bank`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + req.user["userToken"],
      },
      data: data,
    });

    let saveBank;
    if (response.data.usd.length > 0) {
      const myBank = new bankAccountSchema({
        id: response.data.usd[0].id,
        user_id: req.user["id"],
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
        .json(rs.successResponse("BANK LINKED", responses));
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

/**
 * @description SFox Api for the verification of the bank as per the discussion with Nihar will be activated in the production environment and also for
 * testing purpose SFox will be providing us some testing bank account
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.verifyBank = async (req, res) => {
  try {
    let getBanks = await bankAccountSchema
      .scan()
      .where("user_id")
      .eq(req.user["id"])
      .exec();

    if (getBanks.count === 0) {
      return res
        .status(responseCode.successNoRecords)
        .json(rs.dataNotExist("BANK "));
    }

    if (process.env.NODE_ENV == "production") {
      const { verifyAmount1, verifyAmount2 } = req.body;

      let apiPath = `${process.env.SFOX_BASE_URL}/v1/user/bank/verify`;
      let response = await axios({
        method: "post",
        url: apiPath,
        headers: {
          Authorization: "Bearer " + req.user["userToken"],
        },
        data: {
          verifyAmount1: verifyAmount1,
          verifyAmount2: verifyAmount2,
        },
      });
      console.log(response?.data);
    }

    let verifyBank;
    verifyBank = await bankAccountSchema.update(
      { id: getBanks[0].id },
      { verificationSent: true, verifiedStatus: "Success" }
    );
    return res.status(200).json({ message: verifyBank });
  } catch (err) {
    console.log(err);
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

    if (response.status == 200) {
      await bankAccountSchema.delete({ user_id: user_id, id: bank_id });
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

exports.dashboard1 = async (req, res) => {
  try {
    let refund = 0;
    let monetization = 0;
    let adjustments = 0;
    let registeredYear = momentTZ(req.user["createDate"])
      .tz(req.user["timeZone"])
      .year();

    let currentYear = momentTZ(moment().toISOString())
      .tz(req.user["timeZone"])
      .year();
    console.log("registeredYear", currentYear);

    let isRegisteredCurrentYear = registeredYear == currentYear ? true : false;
    let startYear = currentYear;

    let startMonth = 1;
    if (isRegisteredCurrentYear) {
      startYear = registeredYear;
      startMonth =
        momentTZ(req.user["createDate"]).tz(req.user["timeZone"]).month() + 1; // +1 as the numbering in the momentjs libary starts from 0 index
    }

    let paymentData = await TransactionLog.scan()
      .attributes([
        "id",
        "amount",
        "email",
        "status",
        "createDate",
        "timestamp",
        "txHash",
        "outwardBaseAmount",
        "outwardCurrency",
        "inwardBaseAmount",
        "inwardCurrency",
        "customerAddress",
      ])
      .where("user_id")
      .eq(req.user["id"])
      .where("txnStatus")
      .eq(true)
      .where("marketOrderStatus")
      .eq(true)
      .where("withdrawStatus")
      .eq(true)
      .where("action")
      .eq("deposit")
      .exec();

    paymentData = paymentData.map((e) => ({
      amount: e.outwardBaseAmount,
      date: e.createDate,
      status: e.status,
      email: e.email,
      id: e.id,
      timestamp: e.timestamp,
      txHash: e.txHash,
      outwardBaseAmount: e.outwardBaseAmount,
      outwardCurrency: e.outwardCurrency,
      inwardBaseAmount: e.inwardBaseAmount,
      inwardCurrency: e.inwardCurrency,
      customerAddress: e.customerAddress,
    }));

    let paymentOutData = await TransactionLog.scan()
      .attributes([
        "id",
        "status",
        "createDate",
        "outwardTotalAmount",
        "inwardCurrency",
      ])
      .where("user_id")
      .eq(req.user["id"])
      .where("txnStatus")
      .eq(true)
      .where("marketOrderStatus")
      .eq(true)
      .where("withdrawStatus")
      .eq(true)
      .where("action")
      .eq("charge")
      .exec();

    let tSales = [];
    let currencyObjects;
    let customerCount = 0;
    if (paymentData.length !== 0) {
      const uniqueRecords = {};

      paymentData.forEach((record) => {
        if (!uniqueRecords.hasOwnProperty(record.customerAddress)) {
          uniqueRecords[record.customerAddress] = record;
        }
      });

      customerCount = Object.keys(uniqueRecords).length;

      let filterData = paymentData.filter(
        (e) => startYear === momentTZ(e.date).tz(req.user["timeZone"]).year()
      );

      let uniqueCurrencies = [
        ...new Set(paymentData.map((e) => e.inwardCurrency)),
      ];

      currencyObjects = uniqueCurrencies.map((currency) => ({
        name: currency,
      }));
      while (startMonth <= 12) {
        uniqueCurrencies.forEach((currency) => {
          let dataArr = filterData.filter(
            (e) =>
              momentTZ(e.date).tz(req.user["timeZone"]).month() + 1 ===
                startMonth && e.inwardCurrency === currency
          );

          if (dataArr.length > 0) {
            let CryptoAmount = 0;

            dataArr.forEach((e) => (CryptoAmount += e.inwardBaseAmount));

            tSales.push({
              month: startMonth,
              currency: currency,
              amount: CryptoAmount,
            });
          } else {
            tSales.push({
              month: startMonth,
              currency: currency,
              amount: 0,
            });
          }
        });
        console.log(startMonth);
        startMonth++;
      }
    }

    let totalRev = 0;

    let monthData = [];
    let month = 1;
    for (let i = 0; i < paymentData.length; i++) {
      totalRev =
        totalRev +
        paymentData[i].outwardBaseAmount -
        refund -
        monetization -
        adjustments;
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
            total +
            paymentData[i].outwardBaseAmount -
            refund -
            monetization -
            adjustments;
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

    let monthPurchase = [];
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
      .eq(req.user["id"])
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
      totalCustomers: customerCount,
      monthlyCustomers: monthlyCustomer,
      customersPercentage: null,
      totalRevenue: totalRev ? totalRev : 0,
      monthlyRevenue: monthData,
      revenuePercentage: null,
      totalSales: tSales,
      currencies: currencyObjects,
      paymentData:
        paymentData.length > 0
          ? paymentData.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4)
          : null,
      payoutData:
        paymentOutData.length > 0
          ? paymentOutData
              .sort((a, b) => b.createDate - a.createDate)
              .slice(0, 4)
          : [],
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

// ADD SALES IN THE DASHBOARD API -- NIHAR
// exports.dashboard = async (req, res) => {
//   try {
//     let refund = 0;
//     let monetization = 0;
//     let adjustments = 0;

//     let registeredYear = momentTZ(req.user["createDate"])
//       .tz(req.user["timeZone"])
//       .year();

//     let currentYear = momentTZ(moment().toISOString())
//       .tz(req.user["timeZone"])
//       .year();
//     console.log("registeredYear", currentYear);

//     let isRegisteredCurrentYear = registeredYear == currentYear ? true : false;
//     let startYear = currentYear;

//     let startMonth = 1;
//     if (isRegisteredCurrentYear) {
//       startYear = registeredYear;
//       startMonth =
//         momentTZ(req.user["createDate"]).tz(req.user["timeZone"]).month() + 1; // +1 as the numbering in the momentjs libary starts from 0 index
//     }

//     let paymentData = await TransactionLog.scan()
//       .attributes([
//         "id",
//         "amount",
//         "email",
//         "status",
//         "createDate",
//         "timestamp",
//         "txHash",
//         "cryptoCurrencyAmount",
//         "cryptoCurrency",
//       ])
//       .where("user_id")
//       .eq(req.user["id"])
//       .where("txnStatus")
//       .eq(true)
//       .exec();

//     paymentData = paymentData.map((e) => ({
//       amount: e.amount,
//       date: e.createDate,
//       status: e.status,
//       email: e.email,
//       id: e.id,
//       timestamp: e.timestamp,
//       txHash: e.txHash,
//       cryptoCurrencyAmount: e.cryptoCurrencyAmount,
//       cryptoCurrency: e.cryptoCurrency,
//     }));

//     let tSales = [];
//     if (paymentData.length !== 0) {
//       let filterData = paymentData.filter(
//         (e) => startYear === momentTZ(e.date).tz(req.user["timeZone"]).year()
//       );

//       let uniqueCurrencies = [
//         ...new Set(paymentData.map((e) => e.cryptoCurrency)),
//       ];
//       while (startMonth <= 12) {
//         uniqueCurrencies.forEach((currency) => {
//           let dataArr = filterData.filter(
//             (e) =>
//               momentTZ(e.date).tz(req.user["timeZone"]).month() + 1 ===
//                 startMonth && e.cryptoCurrency === currency
//           );

//           let totalAmount = dataArr.reduce(
//             (total, e) => total + e.cryptoCurrencyAmount,
//             0
//           );

//           // Check if the currency already exists in tSales
//           let existingCurrency = tSales.find(
//             (item) => item.currency === currency
//           );

//           if (existingCurrency) {
//             // If the currency exists, update the existing entry
//             existingCurrency.months.push({
//               month: startMonth,
//               amount: totalAmount,
//             });
//           } else {
//             // If the currency doesn't exist, add a new entry
//             tSales.push({
//               currency: currency,
//               months: [
//                 {
//                   month: startMonth,
//                   amount: totalAmount,
//                 },
//               ],
//             });
//           }
//         });

//         startMonth++;
//       }
//     }

//     let totalRev = 0;
//     // for(let i=0;i<paymentData.data.length;i++){
//     // totalRev = totalRev +  (paymentData.data[i].quantity * paymentData.data[i].rate) - refund - monetization - adjustments ;
//     // const dateString = paymentData.data[i].transfer_date;
//     // const date = new Date(dateString);
//     // let  getMonth = date.getUTCMonth() + 1

//     let monthData = [];
//     let month = 1;
//     for (let i = 0; i < paymentData.length; i++) {
//       totalRev =
//         totalRev + paymentData[i].amount - refund - monetization - adjustments;
//     }
//     while (month < 31) {
//       let total = 0;
//       for (let i = 0; i < paymentData.length; i++) {
//         const dateString = paymentData[i].date;
//         const date = new Date(dateString);
//         let getMonth = date.getDate();
//         let onlymon = date.getUTCMonth() + 1;

//         if (getMonth == month) {
//           total =
//             total + paymentData[i].amount - refund - monetization - adjustments;
//         }
//       }
//       if (total != 0)
//         monthData.push({
//           day: month,
//           totalAmount: total.toFixed(2),
//           month: 11,
//         });
//       month = month + 1;
//     }

//     let monthPurchase = [];
//     let mon = 1;
//     while (mon < 31) {
//       let totals = 0;
//       for (let i = 0; i < paymentData.length; i++) {
//         const dateString = paymentData[i].date;
//         const date = new Date(dateString);
//         let getMonth = date.getDate();
//         //date.getUTCMonth() + 1;
//         if (getMonth == mon) {
//           let purchaseLength = [];
//           purchaseLength.push(paymentData[i]);

//           totals = totals + purchaseLength.length;
//         }
//       }
//       if (totals != 0)
//         monthPurchase.push({ day: mon, purchase: totals, month: 11 });
//       mon = mon + 1;
//     }

//     let totalCustomers = await CustomerWalletAddress.scan()
//       .where("user_id")
//       .eq(req.user["id"])
//       .exec();

//     let customerCurrency = "";
//     let monthlyCustomer = [];
//     let customerCurrenc = [];
//     let months = 1;
//     while (months < 31) {
//       let totalCus = 0;

//       for (let i = 0; i < totalCustomers.length; i++) {
//         const dateString = totalCustomers[i].createDate;
//         const date = new Date(dateString);
//         let getMonths = date.getDate();
//         let onlymon = date.getUTCMonth() + 1;

//         if (getMonths == months) {
//           customerCurrency = customerCurrency + totalCustomers[i].currency;
//           let customerLength = [];
//           customerLength.push(totalCustomers[i]);

//           totalCus = totalCus + customerLength.length;
//         }
//       }
//       if (totalCus != 0)
//         customerCurrenc.push({
//           day: months,
//           currency: customerCurrency,
//           month: 11,
//         });

//       monthlyCustomer.push({
//         day: months,
//         customers: totalCus,
//         month: 11,
//       });
//       months = months + 1;
//     }

//     let responses = {
//       totalPurchase: paymentData.length ? paymentData.length : 0,
//       monthlyPurchase: monthPurchase ? monthPurchase : 0,
//       purchasePercentage: null,
//       totalCustomers: totalCustomers.count,
//       monthlyCustomers: monthlyCustomer,
//       customersPercentage: null,
//       totalRevenue: totalRev ? totalRev : 0,
//       monthlyRevenue: monthData,
//       revenuePercentage: null,
//       totalSales: tSales,
//       paymentData:
//         paymentData.length > 0
//           ? paymentData.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4)
//           : null,
//       payoutData: null,
//     };

//     return res
//       .status(responseCode.success)
//       .json(rs.successResponse("DATA RETRIVED", responses));
//   } catch (error) {
//     return res
//       .status(responseCode.serverError)
//       .json(rs.errorResponse(error?.message.toString()));
//   }
// };

// console.log(
//   momentTZ("2023-10-16T23:59:23.803Z").tz("America/New_York").daysInMonth()
// );
exports.addTeam = async (req, res) => {
  try {
    const { email, role } = req.body;
    // 1 for Admin 2 for Analyst
    let roleList = [1, 2];

    let isRole = roleList.includes(parseInt(role));
    if (!isRole)
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("ROLE TYPE DOES NOT EXIST"));

    // Check if the email already exists in the database
    const existingUser = await User.scan().where("email").eq(email).exec();

    if (existingUser[0]?.isAccepted == false)
      return res
        .status(responseCode.success)
        .json(rs.successResponse("REQUEST ALREADY SENT"));

    if (existingUser.count === 1) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER ALREADY EXISTS", {}));
    }

    const inviteUser = uuidv4();

    let mailDetails = {
      from: `${process.env.FROM_EMAIL}`,
      to: email,
      subject: "HiFi Member Invitation",
      text: `Please fill up the google form, \n ${process.env.REGISTER_FORM_LINK}`,
      fileName: "InviteTemplate.ejs",
      link: `${process.env.FRONTEND_URL}/auth/invite?invite_user=${inviteUser}`,
      password: process.env.REGISTER_PASSWORD,
    };

    const generate = await sendEmail.generateEmail(mailDetails);

    if (!generate.messageId) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("WRONG EMAIL ID", {}));
    }

    let cipherText = common.encryptText(process.env.REGISTER_PASSWORD);

    const myUser = new User({
      user_id: inviteUser,
      email: email,
      password: cipherText,
      phoneNumber: "",
      fullName: "",
      businessName: req.user["businessName"],
      userToken: "",
      secretkey: "",
      timeZone: "",
      invitedBy: req.user["id"],
      role: parseInt(role),
    });

    // Save user data to the database
    let user = await myUser.save();

    console.log("usernew", user);

    return res
      .status(responseCode.success)
      .json(rs.successResponse("INVITATION SENT"));
  } catch (error) {
    // Handle any other errors
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

exports.acceptInvite = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Retrieve user details by user_id
    const invitedUser = await User.get(user_id);

    if (!invitedUser) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("INVALID INVITATION", {}));
    }

    // Get the user who sent the invitation
    const invitingUser = await User.get(invitedUser.invitedBy);

    if (!invitingUser) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("INVALID INVITING USER", {}));
    }
    // Update the invited user's status
    invitedUser.isAccepted = true;
    invitedUser.isOTPVerified = true;
    invitedUser.isSfoxVerified = true;
    invitedUser.sfox_id = invitingUser.sfox_id;
    invitedUser.userToken = invitingUser.userToken;

    // Save the updated invited user details
    await invitedUser.save();

    return res
      .status(responseCode.success)
      .json(rs.successResponse("INVITATION ACCEPTED", {}));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

exports.teamList = async (req, res) => {
  try {
    let teamList = await User.scan()
      .attributes([
        "fullName",
        "email",
        "isVerified",
        "createDate",
        "role",
        "isAccepted",
      ])
      .where("invitedBy")
      .eq(req.user["id"])
      .exec();

    let updatedTeamList = [];
    const roleNames = {
      0: "SUPER_ADMIN",
      1: "ADMIN",
      2: "ANALYST",
    };
    if (teamList.count > 0) {
      updatedTeamList = teamList.map((user) => ({
        ...user,
        roleName: roleNames[user.role],
      }));
    }

    updatedTeamList.unshift({
      createDate: moment().toISOString(),
      role: 0,
      isAccepted: true,
      email: req.user["email"],
      fullName: req.user["fullName"],
      isVerified: true,
      roleName: roleNames[0],
    });

    return res
      .status(responseCode.success)
      .json(rs.successResponse("RETRIVED TEAM LIST", updatedTeamList));
  } catch (error) {}
};

exports.dashboard = async (req, res) => {
  try {
    let paymentData = await TransactionLog.scan()
      .attributes([
        "id",
        "email",
        "status",
        "createDate",
        "timestamp",
        "txHash",
        "outwardBaseAmount",
        "outwardCurrency",
        "inwardBaseAmount",
        "inwardCurrency",
        "customerAddress",
        "action",
      ])
      .where("user_id")
      .eq(req.user["id"])
      .where("txnStatus")
      .eq(true)
      .where("marketOrderStatus")
      .eq(true)
      .where("withdrawStatus")
      .eq(true)
      .where("action")
      .in(["deposit", "withdraw", "payout"])
      .exec();

    let totalPurchase = 0; // The number of payments by the customer.
    let totalVolume = 0; // The sum of the payment done by the customer.
    const uniqueRecords = {};
    let customerCount = 0;
    let paymentArray = [];
    let payoutArray = [];

    let refund = 0;
    let monetization = 0;
    let adjustments = 0;
    let registeredYear = momentTZ(req.user["createDate"])
      .tz(req.user["timeZone"])
      .year();
    console.log("registeredYear", registeredYear);
    let currentYear = momentTZ(moment().toISOString())
      .tz(req.user["timeZone"])
      .year();
    console.log("currentYear", currentYear);

    let isRegisteredCurrentYear = registeredYear == currentYear ? true : false;
    console.log(isRegisteredCurrentYear);
    let startYear = currentYear;

    let startMonth = 1;
    if (isRegisteredCurrentYear) {
      startYear = registeredYear;
      // +1 as the numbering in the momentjs libary starts from 0 index
      startMonth =
        momentTZ(req.user["createDate"]).tz(req.user["timeZone"]).month() + 1;
    }
    let monthlySums = {};
    let currencies = {};

    if (paymentData.count !== 0) {
      paymentData.map((txn) => {
        if (txn.action == "deposit") {
          totalVolume += txn.outwardBaseAmount;
          totalPurchase += +1;
          if (paymentArray.length < 4) paymentArray.unshift(txn);

          // Convert transaction date to the user's timezone
          let txnDate = momentTZ(txn.createDate).tz(req.user["timeZone"]);
          // Check if the transaction is in the start year and month is greater or equal to startMonth
          if (
            txnDate.year() === startYear &&
            txnDate.month() + 1 >= startMonth
          ) {
            let month = txnDate.month() + 1; // Get month (1-12)

            if (!currencies[txn.inwardCurrency]) {
              currencies[txn.inwardCurrency] = {
                name: txn.inwardCurrency,
              };
            }

            // Initialize the month in monthlySums if not already there
            if (!monthlySums[month]) {
              monthlySums[month] = {};
            }

            // Initialize the currency in the month if not already there
            if (!monthlySums[month][txn.inwardCurrency]) {
              monthlySums[month][txn.inwardCurrency] = {
                month: month,
                currency: txn.inwardCurrency,
                amount: 0,
              };
            }

            // Add the transaction amount to the sum for the month and currency
            // Assuming txn.inwardBaseAmount is the amount of the transaction
            monthlySums[month][txn.inwardCurrency].amount +=
              txn.inwardBaseAmount;
          }
          if (!uniqueRecords.hasOwnProperty(txn.customerAddress)) {
            uniqueRecords[txn.customerAddress] = txn;
          }
        }

        if (txn.action == "payout" && payoutArray.length < 4)
          payoutArray.unshift(txn);
      });
      customerCount = Object.keys(uniqueRecords).length;
    }

    // totalRevenue = deposit - refund - monetization - adjastments

    let responses = {
      totalPurchase: totalPurchase,
      totalVolume,
      totalSales: monthlySums,
      currencies: Object.values(currencies),
      paymentData: paymentArray,
      payoutData: payoutArray,
      totalCustomers: customerCount,
      monthlyPurchase: 0,
      purchasePercentage: null,
      monthlyCustomers: 0,
      customersPercentage: null,
      totalRevenue: 0,
      monthlyRevenue: 0,
      revenuePercentage: null,
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
