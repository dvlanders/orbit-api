const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("./../models/transfer");
const User = require("./../models/userAuth");
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
const payment = require("./payment");
const refund = require("./refund");
const { sendEmail, common } = require("../util/helper");
const { responseCode, rs } = require("../util");
const bankAccountSchema = require("./../models/bankAccounts");
const TransactionLog = require("../models/transactionLog");

//Transfer PAYOUT in the merchant Account

async function makeTranferPayout() {
  try {
    let userList = await User.scan()
      .attributes(["user_id", "userToken", "sfox_id"])
      .where("user_id")
      .in([
        "4fb4ef7b-5576-431b-8d88-ad0b962be1df",
        "838a911a-3e2a-4411-842a-7befaf0f0ae0",
      ])
      .exec();
    if (userList.count === 0) return;
    // console.log(userList);

    let users = userList.map((e) => e.user_id);

    let getBankList = await bankAccountSchema
      .scan()
      .where("user_id")
      .in(users)
      .exec();

    if (getBankList.count === 0) return;

    let bankObjectsWithUserData = getBankList.map((bankUser) => {
      // Find the user data from the userList
      let userData = userList.find((usr) => usr.user_id === bankUser.user_id);

      // Combine the bankUser object with the userData
      return {
        ...bankUser,
        ...userData,
      };
    });

    console.log(bankObjectsWithUserData);

    bankObjectsWithUserData.map(async (usr) => {
      let apiPath = `${process.env.SFOX_BASE_URL}/v1/user/balance`;
      let checkBalance = await axios({
        method: "get",
        url: apiPath,
        headers: {
          Authorization: "Bearer " + usr.userToken,
        },
      });

      let balance = [];
      if (checkBalance?.data) {
        balance = checkBalance?.data?.filter((e) => e.currency === "usd");
        if (balance.length !== 0) {
          if (balance[0].available < 10) return;
          balance = balance[0];
        }
      }

      console.log(balance);

      let apiPathTransfer = `${process.env.SFOX_BASE_URL}/v1/enterprise/transfer`;
      let response = await axios({
        method: "post",
        url: apiPathTransfer,
        headers: {
          Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
        },
        data: {
          transfer_id: uuid,
          user_id: req.user["sfox_id"],
          type: "PAYOUT",
          purpose: "GOOD",
          description: "Payout To The Merchant",
          currency: "usd",
          quantity: 10,
          rate: 10,
        },
      });
    });

    // let payoutData = response?.data?.data;

    // if (payoutData) {
    //   let apiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
    //   console.log(apiPath);
    //   let marketOrderTxn = await axios({
    //     method: "get",
    //     url: apiPath,
    //     headers: {
    //       Authorization: "Bearer " + req.user["userToken"],
    //     },
    //     // change the limit formula based on teh side type
    //     params: {
    //       types: "credit",
    //       limit: 5,
    //     },
    //   });

    //   if (marketOrderTxn?.data.length > 0) {
    //     let finalData = marketOrderTxn?.data.filter(
    //       (e) => payoutData.atx_id_credited === e.atxid
    //     );
    //     if (finalData.length > 0) {
    //       let finalObj = finalData[0];
    //       let saveData = await TransactionLog.create({
    //         id: uuidv4(),

    //       });
    //     }
    //   }
    // }

    //   {
    //     "id": 4134310,
    //     "atxid": 2260083,
    //     "order_id": "",
    //     "client_order_id": "",
    //     "day": "2023-11-29T13:04:37.000Z",
    //     "action": "Credit",
    //     "currency": "usd",
    //     "memo": "Payout To The Merchant",
    //     "amount": 10,
    //     "net_proceeds": 10,
    //     "price": 1,
    //     "fees": 0,
    //     "status": "done",
    //     "hold_expires": "",
    //     "tx_hash": "",
    //     "algo_name": "",
    //     "algo_id": "",
    //     "account_balance": 34.04087562,
    //     "AccountTransferFee": 0,
    //     "description": "",
    //     "wallet_display_id": "5a3f1b1c-719d-11e9-b0be-0ea0e44d1000",
    //     "added_by_user_email": "skcloud21a@gmail.com",
    //     "symbol": null,
    //     "IdempotencyId": "d3ce13a1-ebed-422f-a3e0-47a9c1042c9d",
    //     "timestamp": 1701263077000
    // },

    //   "transfer_id": "c1c92583-af23-4648-bf8e-6780a38fed30",
    //   "transfer_status_code": "COMPLETE",
    //   "type": "PAYOUT",
    //   "quantity": 10,
    //   "currency": "usd",
    //   "user_id": "418909b5-8b30-4d25-b724-efac389f7722",
    //   "rate": 10,
    //   "purpose": "GOOD",
    //   "description": "Payout To The Merchant",
    //   "atx_id_charged": 2259853,
    //   "atx_id_credited": 2259854,
    //   "atx_status_charged": 1200,
    //   "atx_status_credited": 1200,
    //   "transfer_date": "2023-11-29T12:01:54.000Z"
  } catch (error) {
    console.log(error.toString());
  }
}

// makeTranferPayout();

exports.createTransfer = async (req, res) => {
  try {
    const { cuser_id: customer_user_id } = req.params;

    console.log(customer_user_id);

    if (!customer_user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }
    console.log(req?.body?.quantity);
    if (!(req?.body?.quantity >= 11))
      return res
        .status(responseCode.badRequest)
        .json(
          rs.incorrectDetails(
            "QUANTITY MUST BE GREATER THAN OR EQUAL TO 11",
            {}
          )
        );

    const userDetails = await User.get(customer_user_id);
    console.log(userDetails);

    if (userDetails == undefined) {
      common.eventBridge("CUSTOMER USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("CUSTOMER USER NOT FOUND", {}));
    }

    let data = {
      type: req.body.type,
      purpose: req.body.purpose,
      description: req.body.description,
      currency: req.body.currency,
      quantity: req.body.quantity,
      rate: req.body.rate,
    };

    data.user_id = userDetails.sfox_id;

    console.log(data);

    // data.transfer_id = uuidv4();

    // let apiPath = `${baseUrl}/v1/enterprise/transfer`;
    // let response = await axios({
    //   method: "post",
    //   url: apiPath,
    //   headers: {
    //     Authorization: "Bearer " + process.env.SFOX_ENTERPRISE_API_KEY,
    //   },
    //   data: data,
    // });
    // if (response.data) {
    //   const transfers = new Transfer({
    //     user_id: customer_user_id,
    //     type: response.data.data.type,
    //     purpose: response.data.data.purpose,
    //     description: response.data.data.description,
    //     currency: response.data.data.currency,
    //     quantity: response.data.data.quantity,
    //     rate: response.data.data.rate,
    //     transfer_id: response.data.data.transfer_id,
    //     transfer_status_code: response.data.data.transfer_status_code,
    //     atx_id_charged: response.data.data.atx_id_charged,
    //     atx_id_credited: response.data.data.atx_id_credited,
    //     atx_status_charged: response.data.data.atx_status_charged,
    //     atx_status_credited: response.data.data.atx_status_credited,
    //     transfer_date: response.data.data.transfer_date,
    //   });
    //   let transferAdded = await transfers.save();
    // if (transferAdded)
    return res
      .status(200)
      .json(rs.successResponse("TRANSFER", response?.data?.data));
    // }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(500).send(error?.response?.data);
  }
};

exports.confirmTransferPayment = async (req, res) => {
  try {
    const { user_id, transfer_id } = req.params;
    const { otp } = req.body;

    if (!user_id || !transfer_id || !otp) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    const userDetails = await User.get(user_id);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let isTransfer = await Transfer.scan()
      .where("transfer_id")
      .eq(transfer_id)
      .where("user_id")
      .eq(user_id)
      .exec();

    console.log(isTransfer?.count == 0);
    if (isTransfer?.count === 0)
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("TRANSFER NOT FOUND", {}));

    if (isTransfer[0].transfer_status_code == "COMPLETE")
      return res
        .status(200)
        .json(rs.successResponse("PAYMENT IS ALREADY VERIFIED"));

    let apiPath = `${baseUrl}/v1/enterprise/transfer/confirm`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: {
        transfer_id,
        otp,
      },
    });

    let isupdated = await Transfer.update(
      { transfer_id: transfer_id },
      { transfer_status_code: "COMPLETE" }
    );

    return res
      .status(responseCode.success)
      .json(rs.successResponse("VERIFIED OTP"));
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(error?.response?.status)
      .json(rs.errorResponse(error.response.data, error?.response?.status));
  }
};

exports.deleteTransfer = async (req, res) => {
  try {
    let transferId = req.params.transferId;
    let apiPath = `${baseUrl}/v1/enterprise/transfer/${transferId}`;
    await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.transferStatus = async (req, res) => {
  try {
    let from_date = req.query.from_date;
    let to_date = req.query.to_date;
    let type = req.query.type;
    let purpose = req.query.purpose;
    let status = req.query.status;
    let apiPath = `${baseUrl}/v1/enterprise/transfer/history?${from_date}&${to_date}&${type}&${purpose}&${status}`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response?.status).send(error.response.data);
  }
};

// Withdrawal
// 24 hours
exports.withdrawalCalculation = async (req, res) => {
  try {
    const { user_id } = req.params;
    if (!user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE PROVIDE USERID", {}));
    }
    const userDetails = await User.scan().where("user_id").eq(user_id).exec();

    console.log("ddddddddddddddddddddddddd", userDetails, user_id);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let refunds = 0;

    let paymentReq = { params: { user_id: user_id } };
    let paymentData = await payment.transaction(paymentReq);

    let totalPayment = 0;
    for (let i = 0; i < paymentData.length; i++) {
      totalPayment = totalPayment + paymentData[i].amount;
    }

    let montizeAmount = ((totalPayment - refunds) * 2.5) / 100;

    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/monetization/settings`;
    let responses = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: {
        feature: "SPOT_TRADE",
        amount: montizeAmount,
        method: "FEE_RATE",
        user_id: userDetails[0].sfox_id,
      },
    });

    let monetizationFee = responses.data.monetization_amount;

    totalWithdrawal = totalPayment - refunds - monetizationFee;

    let reqs = {
      params: { user_id: user_id },
      body: { currency: "USD", amount: totalWithdrawal, isWire: true },
    };
    let depositBank = await refund.withdrawalBank(reqs);

    let getBank = await axios({
      method: "delete",
      url: `${baseUrl}/v1/user/bank`,
      headers: {
        Authorization: "Bearer " + userDetails[0].userToken,
      },
    });

    let finalResponse = {
      amount: totalWithdrawal,
      description: "PAYOUT",
      date: "",
      bankAccount: getBank.data.usd[0].bank_name,
    };
    return res
      .status(responseCode.success)
      .json(rs.successResponse("PAYOUT DONE", finalResponse));
  } catch (error) {
    console.log("erorrrrrrrrrrrrrrrrrrrrr", error);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};
exports.withdrawal = async (req, res) => {
  try {
    const apiPath = `${baseUrl}/v1/user/withdraw/confirm`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      data: req.body,
    });

    const withdrawalData = {
      currency: currency,
      address: address,
      amount: amount,
      isWire: false,
    };

    const params = {
      TableName: "WithdrawalsTable", // Replace with our DynamoDB table name (Sultan)
      Item: withdrawalData,
    };

    // await dynamoDB.put(params).promise();
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    console.log("erroror", error);
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response?.status).send(error.response.data);
  }
};

exports.resendWithdrawal = async (req, res) => {
  try {
    const apiPath = `${baseUrl}/v1/user/withdraw/resend-confirmation`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
      data: req.body,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    console.log("erroror", error);
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response?.status).send(error.response.data);
  }
};

exports.cancelWithdrawal = async (req, res) => {
  try {
    const apiPath = `${baseUrl}/v1/transactions/:${atx_id}`;
    await axios({
      method: "delete",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userToken,
      },
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    console.log("erroror", error);
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response?.status).send(error.response.data);
  }
};
