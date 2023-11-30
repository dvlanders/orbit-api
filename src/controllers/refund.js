const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("./../models/transfer");
const User = require("./../models/userAuth");
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
const { sendEmail, common } = require("../util/helper");
const { responseCode, rs } = require("../util");
const TransactionLog = require("../models/transactionLog");

// TODO REFUND INTEGRATE WITH THE DB -- NIHAR - Done
// BELOW ARE THE MARKETORDER API -- NIHAR - Done
/**
 * @description
 * 1. Wire Intructions
 * 2. Currency Conversion
 * 3. Market Order
 * 4. Wallet tarnsfer`
 * @param {*} req
 * @param {*} res
 * @returns
 */

exports.withdrawalBank = async (req, res) => {
  try {
    const { user_id, transfer_id } = req.params;
    const { currency, address, amount, isWire } = req.body;
    if (!user_id)
      return res
        .status(responseCode.badRequest)
        .json(rs.dataNotAdded("PROVIDE TRANSFER ID OR USERID", {}));
    let reqs = {
      body: { pair: pair, side: side, quantity: quantity },
      params: { user_id: user_id },
    };
    let bankAmount = await this.currencyConvertion(reqs);

    let data;
    if (currency || address || amount || isWire) {
      data = {
        currency: currency,
        amount: amount,
        isWire: isWire ? isWire : false,
        address: address,
      };
    } else if (currency || amount || isWire) {
      data = {
        currency: currency,
        amount: bankAmount.amount,
        isWire: isWire ? isWire : false,
      };
    }
    const userDetails = await User.get(user_id);
    if (amount < 31 && currency == "usd") {
      return res
        .status(responseCode.badRequest)
        .json(
          rs.incorrectDetails(
            "AMOUNT CANNOT BE LESS THAN 30 USD AS FEE RATE OF USD IS 30",
            {}
          )
        );
    }
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    const withdrawalData = {
      user_id: user_id,
      transfer_id: transfer_id,
      currency: currency,
      amount: amount,
      address: address,
      isWire: isWire ? isWire : false,
    };

    const params = {
      TableName: "WithdrawalsTable", // Replace with our DynamoDB table name for this one (Sultan)
      Item: withdrawalData,
    };

    // await dynamoDB.put(params).promise();

    const apiPath = `${baseUrl}/v1/user/withdraw`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
      data: data,
    });

    return res?.status(response.status).json({ message: response.data.data });
  } catch (error) {
    return res.status(error.response?.status).send(error.response.data);
  }
};

/**
 * market order API is used in the refund process after for to convert the usd to the usdc
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.reundCustomer = async (req, res) => {
  try {
    // @nihar here the rfq and the market order are hit then we can apply for the  with draw
    //  so for this API we can need the to store the data in the DB for the transaction the data is refunding

    const { id } = req.params;

    if (id === null || !id)
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE PASS THE TXN HASH"));

    let transaction = await TransactionLog.scan()
      .where("user_id")
      .eq(req.user["id"])
      .where("id")
      .eq(id)
      .where("txnStatus")
      .eq(true)
      .where("marketOrderStatus")
      .eq(true)
      .exec();

    // console.log(transaction);

    if (transaction.count === 0) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("INVALID TRANSACTION"));
    }
    transaction = transaction[0];
    if (transaction.outwardTotalAmount <= 11) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("REFUND ONLY ABOVE 11 USD"));
    }

    let apiPath = `${process.env.SFOX_BASE_URL}/v1/user/balance`;
    let checkBalance = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + req.user["userToken"],
      },
    });

    let balance = [];
    if (checkBalance?.data) {
      balance = checkBalance?.data?.filter((e) => e.currency === "usd");
      if (balance.length !== 0) {
        if (balance[0]?.balance <= transaction.outwardTotalAmount) {
          return res
            .status(responseCode.badRequest)
            .json(rs.incorrectDetails("MERCHANT HAS LOW FUNDS FOR THE REFUND"));
        }
      }
    }

    let currencyPair = "usdcusd";
    let side = "buy";

    let apiPathQuote = `${process.env.SFOX_BASE_URL}/v1/quote`;
    let RFQResponse = await axios({
      method: "post",
      url: apiPathQuote,
      headers: {
        Authorization: "Bearer " + req.user["userToken"],
      },
      data: {
        pair: currencyPair,
        side: side,
        amount: parseFloat(transaction.outwardTotalAmount),
      },
    });

    console.log(parseFloat(transaction.outwardTotalAmount));
    console.log(transaction.outwardTotalAmount);

    let marketOrderResponse = {};
    if (RFQResponse?.data?.quote_id) {
      console.log(RFQResponse?.data);
      let apiPath = `${baseUrl}/v1/orders/${side}`;
      marketOrderResponse = await axios({
        method: "post",
        url: apiPath,
        headers: {
          Authorization: "Bearer " + req.user["userToken"],
        },
        data: {
          currency_pair: currencyPair,
          amount: RFQResponse?.data?.quantity,
          algorithm_id: 100,
          client_order_id: RFQResponse?.data?.quote_id,
        },
      });
      console.log(marketOrderResponse?.data);

      let saveData = await TransactionLog.create({
        id: uuidv4(),
        merchantAddress: transaction.merchantAddress,
        customerAddress: transaction.customerAddress,
        inwardCurrency: "usd",
        inwardBaseAmount: transaction.outwardTotalAmount,
        cryptoCurrencyAmount: RFQResponse?.data?.quantity,
        outwardCurrency: "usdc",
        outwardBaseAmount: RFQResponse?.data?.quantity,
        walletType: "HIFIPay",
        email: req.user["email"],
        name: req.user["fullName"],
        user_id: req.user["id"],
        price: RFQResponse?.data?.buy_price,
        clientOrderId: RFQResponse?.data?.quote_id,
        action: "withdraw",
        txnStatus: true,
      });
    }
    return res.status(responseCode.success).json(
      rs.successResponse("ORDER CREATED", {
        txn_id: saveData.id,
      })
    );
  } catch (error) {
    console.log("Error creating market order:", error?.response?.data);
    return res
      .status(error?.response?.status || 500)
      .json(rs.errorResponse(error?.response?.data, error?.response?.status));
  }
};

exports.getRefundStatus = async (req, res) => {
  try {
    const { rid } = req.params;

    if (!rid) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    let transationStatus = await TransactionLog.get(rid);

    if (transationStatus == undefined) transationStatus = {};

    if (
      Object.keys(transationStatus).length == 0 ||
      transationStatus.action !== "withdraw"
    ) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("TRANSATION DOES NOT EXIST"));
    }
    console.log(transationStatus.aTxId);

    let status = typeof transationStatus.aTxId == "number";
    console.log(status);
    return res
      .status(responseCode.success)
      .json(
        rs.successResponse("WITHDRAW OTP SENT", {
          status,
          aTxId: transationStatus.aTxId,
        })
      );
  } catch (error) {
    return res
      .status(error?.response?.status || 500)
      .json(rs.errorResponse(error?.response?.data, error?.response?.status));
  }
};

exports.confirmRefund = async (req, res) => {};

exports.MarketOrder = async (req, res) => {
  try {
    const { user_id } = req.params;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let { side } = req.params;
    const response = await axios.post(
      `${baseUrl}/v1/orders/${side}`,
      {
        currency_pair: req.body.currency_pair,
        price: req.body.price,
        quantity: req.body.quantity,
        algorithm_id: req.body.algorithm_id,
        client_order_id: uuidv4(),
      },
      {
        headers: {
          Authorization: `Bearer ${userDetails.userToken}`,
        },
      }
    );

    const orderData = {
      currency_pair: req.body.currency_pair,
      price: req.body.price,
      quantity: req.body.quantity,
      algorithm_id: req.body.algorithm_id,
      client_order_id: uuidv4(),
      // other response from this (Sultan)
      // there are 2 market order api here, which one is correct? (Sultan)
    };

    const params = {
      TableName: "MarketOrdersTable", // Replace with our DynamoDB table name for this one (Sultan)
      Item: orderData,
    };

    // await dynamoDB.put(params).promise();

    if (response.data && response.data.id) {
      return res.status(200).send({
        message: "Order created successfully",
        data: response.data,
      });
    } else {
      return res.status(500).send({
        message: "Failed to create order",
        data: response.data,
      });
    }
  } catch (error) {
    console.error("Error creating market order:", error);
    return res.status(500).send({
      message: "An error occurred while creating the market order",
    });
  }
};

exports.transfer = async (req, res) => {
  try {
    let data = {
      user_id: req.body.user_id,
      type: req.body.type,
      purpose: req.body.purpose,
      description: req.body.description,
      currency: req.body.currency,
      quantity: req.body.quantity,
      rate: req.body.rate,
    };
    data.transfer_id = uuidv4();
    let apiPath = `${baseUrl}/v1/enterprise/transfer`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: data,
    });
    if (response.data) {
      const transfers = new Transfer({
        user_id: response.data.data.user_id,
        type: response.data.data.type,
        purpose: response.data.data.purpose,
        description: response.data.data.description,
        currency: response.data.data.currency,
        quantity: response.data.data.quantity,
        rate: response.data.data.rate,
        transfer_id: response.data.data.transfer_id,
        transfer_status_code: response.data.data.transfer_status_code,
        atx_id_charged: response.data.data.atx_id_charged,
        atx_id_credited: response.data.data.atx_id_credited,
        atx_status_charged: response.data.data.atx_status_charged,
        atx_status_credited: response.data.data.atx_status_credited,
        transfer_date: response.data.data.transfer_date,
      });
      let transferAdded = await transfers.save();
      if (transferAdded)
        return res
          .status(response.status)
          .json({ message: response.data.data });
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.confirmTransfer = async (req, res) => {
  try {
    let apiPath = `${baseUrl}/v1/enterprise/transfer/confirm`;
    await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + token,
      },
      data: req.body,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
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
    return res.status(error.response.status).send(error.response.data);
  }
};

/**
 *
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.walletTransfer = async (req, res) => {
  try {
    let data = {
      currency: req.body.currency,
      quantity: req.body.quantity,
      from_wallet: req.body.from_wallet,
      to_wallet: req.body.to_wallet,
    };

    const { user_id } = req.params;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    data.transfer_id = uuidv4();
    let apiPath = `${baseUrl}/v1/account/transfer`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
      data: data,
    });
    if (response.data) {
      const transfers = new Transfer({
        user_id: response.data.data.user_id,
        type: response.data.data.type,
        purpose: response.data.data.purpose,
        description: response.data.data.description,
        currency: response.data.data.currency,
        quantity: response.data.data.quantity,
        rate: response.data.data.rate,
        transfer_id: response.data.data.transfer_id,
        transfer_status_code: response.data.data.transfer_status_code,
        atx_id_charged: response.data.data.atx_id_charged,
        atx_id_credited: response.data.data.atx_id_credited,
        atx_status_charged: response.data.data.atx_status_charged,
        atx_status_credited: response.data.data.atx_status_credited,
        transfer_date: response.data.data.transfer_date,
      });
      //   let transferAdded = await transfers.save();
      //   if (transferAdded)
      return res.status(response.status).json({ message: response.data.data });
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};

exports.withdrawalBank = async (req, res) => {
  try {
    const { user_id, transaction_id } = req.params;
    const { currency, address, amount, isWire } = req.body;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let datas = {
      currency: currency,
      amount: amount,
      isWire: isWire ? isWire : false,
    };
    if (address) datas.address = address;
    const apiPath = `${baseUrl}/v1/user/withdraw`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
      data: datas,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
    return res.status(error.response?.status).send(error.response.data);
  }
};
