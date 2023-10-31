const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("./../models/transfer");
const AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });
const User = require("./../models/userAuth");

let userToken = process.env.USER_AUTH_TOKEN;
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
let uuid = uuidv4();
const { sendEmail, common } = require("../util/helper");
const { responseCode, rs } = require("../util");

exports.achTransfer = async (req, res) => {
  try {
    const {user_id} = req.params

    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    const response = await axios.post(
      `${baseUrl}/v1/user/bank/deposit`,
      {
        amount: req.body.amount,
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
            DetailType: "ACH Transfer",
            Detail: JSON.stringify(response.data),
            EventBusName: "default",
          },
        ],
      };
      await eventbridge.putEvents(params).promise();

      return res.status(200).send({
        message: "ACH transfer created successfully",
        data: response.data,
      });
    } else {
      return res.status(500).send({
        message: "Failed to create ACH transfer",
        data: response.data,
      });
    }
  } catch (error) {
    console.error("Error creating ACH transfer:", error);
    return res.status(500).send({
      message: "An error occurred while creating the ACH transfer",
    });
  }
};

exports.MarketOrder = async (req, res) => {
  try {
    const {user_id} = req.params
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let {side} = req.params
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
    console.log("dddxxxdxxxxxxxxxxxxxxxxxxxxx",response)

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
