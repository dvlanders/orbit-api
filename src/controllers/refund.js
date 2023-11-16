const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("./../models/transfer");
const AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });
const User = require("./../models/userAuth");
const accountManagement = require("./accountManagement");
let userToken = process.env.USER_AUTH_TOKEN;
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
const { sendEmail, common } = require("../util/helper");
const { responseCode, rs } = require("../util");

exports.wireTransfer = async (req, res) => {
  try {
    const { user_id } = req.params;
    let Req = { params: { user_id: user_id } };
    let transfer = await accountManagement.wireInstructions(Req);
    if (transfer) {
      return res.status(200).send({
        message: "DATA RETRIVED",
        data: transfer,
      });
    }
    return res.status(500).send({
      error: "CANNOT RETRIVED THE DATA",
      data: {},
    });
  } catch (error) {
    return res.status(500).send(error);
  }
};

exports.currencyConvertion = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { pair, side, quantity } = req.body;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    const apiPath = `${baseUrl}/v1/quote`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
      data: {
        pair: pair,
        side: side,
        quantity: quantity,
      },
    });
    if (res) {
      return res.status(response.status).json({ message: response.data });
    } else {
      return response.data;
    }
  } catch (error) {
    // return res.status(error.response?.status).send(error.response.data);
  }
};

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

exports.marketOrder = async (req, res) => {
  try {
    const { user_id, side } = req.params;
    const userDetails = await User.get(user_id);
    console.log(userDetails);

    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let currencyPair = await CurrencyPair.scan()
      .attributes(["base", "quote", "symbol"])
      .where("base")
      .eq(req.body?.currency)
      .where("quote")
      .eq("usdc")
      .exec();

    // console.log(currencyPair);
    console.log(currencyPair[0].symbol);

    let apiPath = `${baseUrl}/v1/orders/${side}`;
    let response = await axios({
      method: "post",
      url: "https://api.staging.sfox.com/v1/orders/buy",
      headers: {
        Authorization:
          "Bearer " +
          "d7ae4196a5c953ddc57cc9cf1d527913d5fa66454cbae0bd0345d8392e4c1dba",
      },
      data: {
        currency_pair: currencyPair[0].symbol,
        price: 12,
        quantity: 0.1,
        algorithm_id: 200,
        client_order_id: uuidv4(),
      },
    });

    console.log(response?.data);

    // if (response.data && response.data.id) {
    //   return res.status(200).send({
    //     message: "Order created successfully",
    //     data: response.data,
    //   });
    // } else {
    //   return res.status(500).send({
    //     message: "Failed to create order",
    //     data: response.data,
    //   });
    // }

    return res
      .status(200)
      .json(rs.successResponse("ORDER CREATED", response?.data));
  } catch (error) {
    console.log("Error creating market order:", error.toString());
    return res.status(500).json({
      message: "An error occurred while creating the market order",
    });
  }
};

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

    if (response.data && response.data.id) {
      const eventbridge = new AWS.EventBridge();
      const params = {
        Entries: [
          {
            Source: "myApp", // change this to our application name
            DetailType: "Market Order",
            Detail: JSON.stringify(response.data),
            EventBusName: "default",
          },
        ],
      };
      await eventbridge.putEvents(params).promise();

      const cloudwatch = new AWS.CloudWatch();
      const alarmParams = {
        AlarmName: "MarketOrderAlarm",
        ComparisonOperator: "GreaterThanThreshold",
        EvaluationPeriods: 1,
        MetricName: "MarketOrder",
        Namespace: "myApp",
        Period: 300,
        Threshold: 1.0,
        ActionsEnabled: true,
        AlarmActions: [
          "arn:aws:sns:us-east-1:123456789012:MySNSTopic", // Replace with your SNS Topic ARN
        ],
        Dimensions: [
          {
            Name: "OrderId",
            Value: response.data.id,
          },
        ],
        Statistic: "Sum",
        Unit: "Count",
      };
      await cloudwatch.putMetricAlarm(alarmParams).promise();

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
