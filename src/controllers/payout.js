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
const cron = require("node-cron");

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
          console.log(balance[0].available);
          if (balance[0].available < 10) return;
          balance = balance[0];
        }
      }

      console.log(balance);

      let uuid = uuidv4();
      let apiPathTransfer = `${process.env.SFOX_BASE_URL}/v1/enterprise/transfer`;
      let responsePayment = await axios({
        method: "post",
        url: apiPathTransfer,
        headers: {
          Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
        },
        data: {
          transfer_id: uuid,
          user_id: usr["sfox_id"],
          type: "PAYMENT",
          purpose: "GOOD",
          description: "Payment To The Merchant",
          currency: "usd",
          quantity: 5,
          rate: 1,
        },
      });
      console.log(responsePayment?.data?.data);

      let payoutData = responsePayment?.data?.data;

      let saveData = await TransactionLog.create({
        id: uuidv4(),
        user_id: usr["user_id"],
        aTxId: payoutData?.atx_id_charged,
        day: payoutData?.transfer_date,
        action: "charge",
        inwardCurrency: payoutData?.currency,
        outwardCurrency: payoutData?.currency,
        idempotencyId: payoutData?.transfer_id,
        timestamp: payoutData?.timestamp,
        merchantAddress: null,
        customerAddress: null,
        inwardBaseAmount: 0,
        outwardBaseAmount: 0,
        walletType: "HiFiPay",
      });
      console.log(saveData);
    });
  } catch (error) {
    console.log(error.toString());
  }
}

async function getPayoutTxn() {
  try {
    let logTxn = await TransactionLog.scan()
      .where("action")
      .eq("charge")
      .where("inwardBaseAmount")
      .eq(0)
      .exec();

    if (logTxn.count === 0) return;

    let userIds = logTxn.map((e) => e.user_id);

    let uniqueUserList = Array.from(new Set(userIds));

    let userList = await User.scan()
      .attributes(["user_id", "userToken", "sfox_id"])
      .where("user_id")
      .in(uniqueUserList)
      .exec();

    let bankObjectsWithUserData = logTxn.map((bankUser) => {
      // Find the user data from the userList
      let userData = userList.find((usr) => usr.user_id === bankUser.user_id);

      // Combine the bankUser object with the userData
      return {
        ...bankUser,
        ...userData,
      };
    });

    if (bankObjectsWithUserData.length === 0) return;

    bankObjectsWithUserData.map(async (usr) => {
      let apiPathTxn = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
      console.log(apiPathTxn);
      let paymentTxn = await axios({
        method: "get",
        url: apiPathTxn,
        headers: {
          Authorization: "Bearer " + usr["userToken"],
        },
        // change the limit formula based on the side type
        params: {
          types: "charge",
          limit: 5,
        },
      });

      console.log(paymentTxn?.data);
      paymentTxn = paymentTxn?.data?.filter(
        (e) => e.IdempotencyId === usr.idempotencyId
      );

      if (paymentTxn.length === 0) return;
      paymentTxn = paymentTxn[0];

      console.log(paymentTxn);

      let saveData = await TransactionLog.update(
        {
          id: usr["id"],
        },
        {
          txId: paymentTxn?.id,
          aTxId: paymentTxn?.atxid,
          day: paymentTxn?.day,
          memo: paymentTxn?.memo,
          inwardBaseAmount: paymentTxn?.amount * -1,
          outwardBaseAmount: paymentTxn?.amount * -1,
          price: paymentTxn?.price,
          inwardTxnFees: paymentTxn?.fees,
          walletType: "HiFiPay",
          status: paymentTxn?.status,
          inwardAccountBalance: paymentTxn?.account_balance,
          accountTransferFee: paymentTxn?.AccountTransferFee,
          idempotencyId: paymentTxn?.IdempotencyId,
          timestamp: paymentTxn?.timestamp,
          txnStatus: true,
          withdrawStatus: true,
          marketOrderStatus: true,
          merchantAddress: null,
          customerAddress: null,
        }
      );
      console.log(saveData);
    });
  } catch (error) {
    console.log(error.toString());
  }
}

cron.schedule("0 2 * * *", () => {
  makeTranferPayout();
});

cron.schedule("0 2 * * *", () => {
  getPayoutTxn();
});

exports.payoutTransations = async (req, res) => {
  try {
    console.log(req.user["id"]);
    let mTransactionList;

    mTransactionList = await TransactionLog.scan()
      .where("user_id")
      .eq(req.user["id"])
      .where("action")
      .eq("charge")
      .where("inwardBaseAmount")
      .not()
      .eq(0)
      .exec();

    console.log(mTransactionList);

    if (mTransactionList.count > 0) {
      let bankDetails = await bankAccountSchema
        .scan()
        .attributes(["account_number", "bank_name"])
        .where("user_id")
        .eq(req.user["id"])
        .exec();
      mTransactionList = mTransactionList.map((transaction) => {
        // Find the corresponding bank detail
        // Merge the transaction object with the bank detail object
        return {
          ...transaction, // spread operator to include all properties of the transaction
          ...bankDetails[0], // spread operator to include all properties of the bank detail
        };
      });
    }

    return res
      .status(responseCode.success)
      .json(rs.successResponse("CUSTOMERS RETRIVED", mTransactionList));
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};

exports.payoutTransationOne = async (req, res) => {
  try {
    console.log(req.user["id"]);
    const { pyid } = req.params;
    if (!pyid) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    let mTransactionList;

    mTransactionList = await TransactionLog.scan()
      .where("user_id")
      .eq(req.user["id"])
      .where("id")
      .eq(pyid)
      .where("action")
      .eq("charge")
      .where("inwardBaseAmount")
      .not()
      .eq(0)
      .exec();

    console.log(mTransactionList);

    if (mTransactionList.count > 0) {
      let bankDetails = await bankAccountSchema
        .scan()
        .attributes(["account_number", "bank_name"])
        .where("user_id")
        .eq(req.user["id"])
        .exec();
      mTransactionList = [
        {
          ...mTransactionList[0], // spread operator to include all properties of the transaction
          ...bankDetails[0], // spread operator to include all properties of the bank detail
        },
      ];
    }

    return res
      .status(responseCode.success)
      .json(
        rs.successResponse(
          "CUSTOMERS RETRIVED",
          mTransactionList.length == 0 ? {} : mTransactionList[0]
        )
      );
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};

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
