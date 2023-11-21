const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("../models/transfer");
const User = require("../models/userAuth");
const Currency = require("../models/currency");
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
const { sendEmail, common } = require("../util/helper");
const { currencyData, currencyPairs } = require("../util/helper/currency");
const { responseCode, rs } = require("../util");
const WalletAddress = require("../models/walletAddress");
const CustomerWalletAddress = require("../models/customerWalletAddress");
const CurrencyPair = require("../models/currencyPairs");
const dynamoose = require("dynamoose");
const TransactionLog = require("../models/transactionLog");

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
        "logoUrl",
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

exports.quoteCurrency = async (req, res) => {
  try {
    const { currency, amount } = req.body;

    if (!amount || !currency)
      return res
        .status(responseCode.badRequest)
        .json(
          rs.incorrectDetails(
            `PLEASE PASS THE ${!amount ? "AMOUNT" : "CURRENCY"}`
          )
        );
    let quote = "usd";
    let currencyPair = currency + quote;
    let side = "sell";
    let amountPass = parseFloat(req.body?.amount);
    // console.log(amountPass);
    let isCurrencyPair = await CurrencyPair.scan()
      .attributes(["base", "quote", "symbol"])
      .where("symbol")
      .eq(currencyPair)
      .where("isActive")
      .eq(true)
      .exec();

    // console.log(isCurrencyPair);
    if (isCurrencyPair.count === 0)
      return res
        .status(responseCode.badGateway)
        .json(rs.incorrectDetails("CURRENCY PAIR NOT SUPPORTED"));

    let apiPath = `${process.env.SFOX_BASE_URL}/v1/quote`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + req.user["userToken"],
      },
      data: {
        pair: currencyPair,
        side: side,
        amount: amountPass,
      },
    });
    console.log(req.user["userToken"]);

    return res
      .status(responseCode.success)
      .json(rs.successResponse("QUOTE PRICE RETRIEVED", response?.data));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error.toString()));
  }
};

exports.addCustomerAddress = async (req, res) => {
  try {
    const {
      merchantAddress,
      customerAddress,
      cryptoCurrency,
      cryptoCurrencyAmount,
      fiatCurrency,
      fiatCurrencyAmount,
      walletType,
      name,
      email,
      quote_id,
      oneCryptoPrice,
      quoteId,
    } = req.body;

    const requiredParams = [
      merchantAddress,
      customerAddress,
      cryptoCurrency,
      cryptoCurrencyAmount,
      fiatCurrency,
      fiatCurrencyAmount,
      walletType,
      quote_id,
      oneCryptoPrice,
      quoteId,
    ];

    const isMissingData = requiredParams.some((param) => !param);

    if (isMissingData) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER ALL THE DETAILS", {}));
    }

    let saveData = await TransactionLog.create({
      id: uuidv4(),
      merchantAddress,
      customerAddress,
      cryptoCurrency,
      cryptoCurrencyAmount: parseFloat(cryptoCurrencyAmount),
      fiatCurrency,
      fiatCurrencyAmount: parseFloat(fiatCurrencyAmount),
      walletType,
      email: email ? email : null,
      name: name ? name : null,
      user_id: req.user["id"],
    });

    console.log(saveData);

    res.status(responseCode.success).json(
      rs.successResponse("ADDED CUSTOMER", {
        seconds: 90,
      })
    );

    setTimeout(async () => {
      try {
        console.log("in the settimeout");
        let apiPath = `${process.env.ETHERSCAN_URL}/api?module=account&action=txlist&address=${customerAddress}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${process.env.ETHERSCAN_KEY}`;
        console.log(apiPath);
        let responseEther = await axios({
          method: "get",
          url: apiPath,
        });

        console.log(responseEther?.data?.result);
        if (responseEther?.data?.result.length > 0) {
          let scaledAmount = BigInt(
            Math.round(parseFloat(cryptoCurrencyAmount) * 1e18)
          );

          let etherscanData = responseEther?.data?.result.filter(
            (e) =>
              e.from === customerAddress &&
              e.to === merchantAddress &&
              BigInt(e.value) === scaledAmount
          );

          // console.log("filterreddata", etherscanData);
          if (etherscanData.length > 0) {
            let apiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
            console.log(apiPath);
            let response = await axios({
              method: "get",
              url: apiPath,
              headers: {
                Authorization: "Bearer " + req.user["userToken"],
              },
              params: {
                types: "deposit",
                limit: 1,
              },
            });
            // console.log(response?.data);
            let finalData = [];
            finalData = response?.data.filter(
              (e) => e.tx_hash === etherscanData[0].hash
            );
            if (finalData.length > 0) {
              console.log(finalData[0].tx_hash);
              let txngasfee =
                parseFloat(
                  BigInt(etherscanData[0].gas) *
                    BigInt(etherscanData[0].gasPrice)
                ) / 1e18;

              const updatedData = await TransactionLog.update(
                { id: saveData.id },
                {
                  txId: finalData[0].id,
                  aTxId: finalData[0].atxId,
                  day: finalData[0]?.day,
                  action: finalData[0]?.action,
                  status: finalData[0].status,
                  txHash: finalData[0].tx_hash,
                  accountTransferFee: finalData[0].AccountTransferFee,
                  timestamp: finalData[0].timestamp,
                  txnGasFee: txngasfee,
                }
              );

              console.log("Transaction log updated:", updatedData);
              // HAS TO BE TESTED
              let side = "sell";
              let apiPath = `${baseUrl}/v1/orders/${side}`;
              let marketOrderResponse = await axios({
                method: "post",
                url: apiPath,
                headers: {
                  Authorization: "Bearer " + req.user["userToken"],
                },
                data: {
                  currency_pair: "ethusd",
                  price: parseFloat(oneCryptoPrice),
                  quantity: parseFloat(cryptoCurrencyAmount),
                  algorithm_id: 100,
                  client_order_id: quoteId,
                },
              });

              if (marketOrderResponse?.data) {
                setTimeout(async () => {
                  let apiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
                  console.log(apiPath);
                  let marketOrderTransaction = await axios({
                    method: "get",
                    url: apiPath,
                    headers: {
                      Authorization: "Bearer " + req.user["userToken"],
                    },
                    params: {
                      types: "sell",
                      limit: 2,
                    },
                  });

                  let marketOrderFinal = [];
                  marketOrderFinal = marketOrderTransaction?.data.filter(
                    (e) => e.currency === "usd" && e.client_order_id === quoteId
                  );

                  if (marketOrderFinal.length > 0) {
                    let marketOrderData = await TransactionLog.update(
                      { id: saveData.id },
                      {
                        txnStatus: true, //
                        orderId: finalData[0]?.order_id,
                        clientOrderId: finalData[0]?.client_order_id,
                        day: finalData[0]?.day,
                        action: finalData[0]?.action,
                        memo: finalData[0]?.memo ? finalData[0]?.memo : null,
                        amount: finalData[0].amount,
                        price: finalData[0].price,
                        fees: finalData[0].fees,
                        status: finalData[0].status,
                        holdExpires: finalData[0]?.hold_expires
                          ? finalData[0].hold_expires
                          : null,
                        txHash: finalData[0].tx_hash,
                        algoName: finalData[0]?.algo_name
                          ? finalData[0].algo_name
                          : null,
                        algoId: finalData[0]?.algo_id
                          ? finalData[0].algo_id
                          : null,
                        accountBalance: finalData[0].account_balance,
                        accountTransferFee: finalData[0].AccountTransferFee,
                        symbol: finalData[0]?.symbol
                          ? finalData[0].symbol
                          : null,
                        idempotencyId: finalData[0]?.IdempotencyId
                          ? finalData[0]?.IdempotencyId
                          : null,
                        timestamp: finalData[0].timestamp,
                        txnGasFee: txngasfee,
                      }
                    );
                  }
                }, 110000);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error updating transaction log:", error);
      }
    }, 110000);
  } catch (error) {
    console.log(error);
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

exports.addcurrencypair = async (req, res) => {
  try {
    const currencyPairsArray = Object.keys(currencyPairs).map((key) => ({
      ...currencyPairs[key],
      key: key,
    }));

    let iscurrencyPair = await CurrencyPair.scan().exec();
    if (iscurrencyPair.count > 0)
      return res
        .status(responseCode.success)
        .json(rs.successResponse("CURRENCY PAIR ALREADY ADDED"));

    currencyPairsArray.map(async (e) => {
      await CurrencyPair.create({
        id: uuidv4(),
        formattedSymbol: e.formatted_symbol,
        symbol: e.symbol,
        base: e.base,
        quote: e.quote,
      });
    });

    console.log(currencyPairsArray.length);

    return res
      .status(responseCode.success)
      .json(rs.successResponse("ADDED THE CURRENCY PAIRS"));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error.toString()));
  }
};
