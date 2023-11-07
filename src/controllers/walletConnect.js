const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("../models/transfer");
const User = require("../models/userAuth");
const Currency = require("../models/currency");
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
const { sendEmail, common } = require("../util/helper");
const { currencyData } = require("../util/helper/currency");
const { responseCode, rs } = require("../util");
const WalletAddress = require("../models/walletAddress");
const CustomerWalletAddress = require("../models/customerWalletAddress");
const dynamoose = require("dynamoose");

/**
 * @description Get Currency List which are available --  API
 */
exports.getCurrency = async (req, res) => {
  try {
    let currency = await Currency.scan()
      .attributes([
        "currency",
        "name",
        "code",
        "symbol",
        "ascii_sign",
        "min_withdrawal",
        "precision",
      ])
      .where("isActive")
      .eq(true)
      .exec();

    return res
      .status(responseCode.success)
      .json(rs.successResponse("CURRENCY RETRIVED", currency));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error.toString()));
  }
};

/**
 * @description This is used to generte and add the Wallet Address of the currency to the DB
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.addWalletAddress = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let isWallet = await WalletAddress.scan()
      .where("user_id")
      .eq(user_id)
      .exec();

    if (isWallet.count !== 0)
      return res
        .status(responseCode.success)
        .json(rs.successResponse("WALLET ADDRESS ALREADY ADDED"));

    console.log(isWallet);

    let currency = await Currency.scan()
      .where("isActive")
      .eq(true)
      .attributes(["currency"])
      .exec();

    let cList = [];
    for (const user of currency) cList.push(user.currency);

    console.log(cList);

    const transactionOperations = cList.map(async (c) => {
      try {
        console.log(c);
        let apiPath = `${process.env.SFOX_BASE_URL}/v1/user/deposit/address/${c}`;
        let response = await axios({
          method: "post",
          url: apiPath,
          headers: {
            Authorization: "Bearer " + userDetails?.userToken,
          },
        });
        if (response?.data) {
          console.log(response?.data);

          return await WalletAddress.transaction.create({
            id: uuidv4(),
            user_id: userDetails.user_id,
            address: response?.data?.address,
            currency: response?.data?.currency,
          });
        }
      } catch (error) {
        // Handle the error here
        console.error("An error occurred:", error);
      }
    });
    console.log(transactionOperations);

    await dynamoose.transaction(transactionOperations);

    return res
      .status(responseCode.success)
      .json(rs.successResponse("WALLET ADDRESS ADDED"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(rs.errorResponse(error.toString()));
  }
};

/**
 *  @description Get one wallet currency address
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.getOneCurrencyWalletAddress = async (req, res) => {
  try {
    const { user_id, currency } = req.params;

    if (!user_id || !currency) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    const walletAddress = await WalletAddress.scan()
      .attributes(["currency", "address", "id"])
      .where("currency")
      .eq(currency)
      .where("user_id")
      .eq(user_id)
      .exec();

    if (walletAddress.count === 0)
      return res
        .status(responseCode.successNoRecords)
        .json(rs.dataNotExist("CURRENCY"));
    return res
      .status(responseCode.success)
      .json(rs.successResponse("CURRENCY RETRIEVED", walletAddress[0]));
  } catch (error) {
    return res.status(500).json(rs.errorResponse(error.toString()));
  }
};

/**
 *
 * @description Onetime Hit API for the data to be entered in the DB
 * @param {*} req
 * @param {*} res
 */
exports.walletCurrency = async (req, res) => {
  try {
    currencyData.map(async (e) => {
      const myCurrency = new Currency({
        id: uuidv4(),
        symbol: e.symbol,
        name: e.name,
        is_fiat: e.is_fiat == 0 ? false : true,
        is_lending_enabled: e.is_lending_enabled == 0 ? false : true,
        can_deposit: e.can_deposit == 0 ? false : true,
        can_withdraw: e.can_withdraw == 0 ? false : true,
        min_withdrawal: e.min_withdrawal,
        confirmations_needed: e.confirmations_needed,
        precision: e.precision,
        ascii_sign: e.ascii_sign,
        contract_address: e.contract_address,
        custody_enabled: e.custody_enabled == 0 ? false : true,
        trading_enabled: e.trading_enabled == 0 ? false : true,
        primary_network: e.primary_network,
        code: e.code,
        currency: e.currency,
      });
      saveBank = await myCurrency.save();
    });
    res.send("ok");
  } catch (error) {
    res.send(error.toString());
  }
};

exports.addCustomerAddress = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (
      (!user_id || req.body?.address || !req.body?.currency,
      !req.body?.walletType)
    ) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    let address = req.body?.address;
    let currency = req.body?.currency;
    let walletType = req.body?.walletType;

    let iswalletConnected = await CustomerWalletAddress.scan()
      .attributes(["id", "address", "currency", "walletType"])
      .where("address")
      .eq(address)
      .where("currency")
      .eq(currency)
      .exec();

    if (iswalletConnected.count > 0) {
      return res
        .status(responseCode.success)
        .json(rs.successResponse("CUSTOMER ALREADY", iswalletConnected[0]));
    }

    let saveData = await CustomerWalletAddress.create({
      id: uuidv4(),
      address,
      currency,
      walletType,
    });

    console.log(saveData);

    return res
      .status(responseCode.success)
      .json(rs.successResponse("ADDED CUSTOMER"));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error.toString()));
  }
};

/**
 *
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.deposit = async (req, res) => {
  try {
    const { currency, user_id } = req.params;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let apiPath = `${baseUrl}/v1/user/deposit/address/${currency}`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
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
    const { currency } = req.query;
    const { user_id } = req.params;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    let apiPath = `${baseUrl}/v1/user/deposit/address/${currency}`;
    let response = await axios({
      method: "get",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
      query: currency,
    });
    return res.status(response.status).json({ message: response.data.data });
  } catch (error) {
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
    // if (req.body.quantity < 11)
    //   return res
    //     .status(responseCode.serverError)
    //     .json(rs.errorResponse("QUANTITY MUST BE GREATER THAN 11", {}));
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
