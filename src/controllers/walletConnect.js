const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/userAuth");
const Currency = require("../models/currency");
let baseUrl = process.env.SFOX_BASE_URL;
const { currencyData, currencyPairs } = require("../util/helper/currency");
const { responseCode, rs } = require("../util");
const WalletAddress = require("../models/walletAddress");
const CurrencyPair = require("../models/currencyPairs");
const dynamoose = require("dynamoose");
const TransactionLog = require("../models/transactionLog");
const cron = require("node-cron");
const { generatePdf } = require("../util/helper/generatePdf");
const { sendEmail } = require("../util/helper");

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
			.json(rs.successResponse("CURRENCY RETRIEVED", currency));
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

		console.log("in the quote");

		if (!amount || !currency)
			return res
				.status(responseCode.badRequest)
				.json(
					rs.incorrectDetails(
						`PLEASE PASS THE ${!amount ? "AMOUNT" : "CURRENCY"}`
					)
				);
		console.log("in the quote1");
		console.log(req.body);
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

		// console.log(isCurrencyPair);

		console.log("istoken   ");
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

		res
			.status(responseCode.success)
			.json(rs.successResponse("QUOTE PRICE RETRIEVED", response?.data));
	} catch (error) {
		console.log(error);
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
			inwardCurrency,
			inwardBaseAmount,
			outwardCurrency,
			outwardBaseAmount,
			walletType,
			name,
			email,
			oneCryptoPrice,
			quoteId,
		} = req.body;

		const requiredParams = [
			merchantAddress,
			customerAddress,
			inwardCurrency,
			inwardBaseAmount,
			outwardCurrency,
			outwardBaseAmount,
			walletType,
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
			clientOrderId: quoteId,
			inwardCurrency,
			inwardBaseAmount: parseFloat(inwardBaseAmount), // directly From the customer,
			outwardCurrency,
			outwardBaseAmount: parseFloat(outwardBaseAmount),
			walletType,
			email: email ? email : null,
			name: name ? name : null,
			user_id: req.user["id"],
			action: "deposit",
			description: req.body?.description ? req.body?.description : null,
		});

		console.log(saveData);

		res.status(responseCode.success).json(
			rs.successResponse("ADDED CUSTOMER", {
				seconds: 90,
			})
		);

		// setTimeout(async () => {
		//   try {
		//     console.log("in the settimeout");
		//     let apiPath = `${process.env.ETHERSCAN_URL}/api?module=account&action=txlist&address=${customerAddress}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${process.env.ETHERSCAN_KEY}`;
		//     console.log(apiPath);
		//     let responseEther = await axios({
		//       method: "get",
		//       url: apiPath,
		//     });

		//     console.log(responseEther?.data?.result);
		//     if (responseEther?.data?.result.length > 0) {
		//       let scaledAmount = BigInt(
		//         Math.round(parseFloat(cryptoCurrencyAmount) * 1e18)
		//       );

		//       let etherscanData = responseEther?.data?.result.filter(
		//         (e) =>
		//           e.from === customerAddress &&
		//           e.to === merchantAddress &&
		//           BigInt(e.value) === scaledAmount
		//       );

		//       console.log("etherscanData", etherscanData);
		//       if (etherscanData.length > 0) {
		//         let apiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
		//         console.log(apiPath);
		//         let response = await axios({
		//           method: "get",
		//           url: apiPath,
		//           headers: {
		//             Authorization: "Bearer " + req.user["userToken"],
		//           },
		//           params: {
		//             types: "deposit",
		//             limit: 1,
		//           },
		//         });
		//         // console.log(response?.data);
		//         let finalData = [];
		//         finalData = response?.data.filter(
		//           (e) => e.tx_hash === etherscanData[0].hash
		//         );
		//         if (finalData.length > 0) {
		//           console.log(finalData[0].tx_hash);
		//           let txngasfee =
		//             parseFloat(
		//               BigInt(etherscanData[0].gas) *
		//                 BigInt(etherscanData[0].gasPrice)
		//             ) / 1e18;

		//           const updatedData = await TransactionLog.update(
		//             { id: saveData.id },
		//             {
		//               txId: finalData[0].id,
		//               aTxId: finalData[0].atxid,
		//               day: finalData[0]?.day,
		//               action: finalData[0]?.action,
		//               status: finalData[0].status,
		//               txHash: finalData[0].tx_hash,
		//               accountTransferFee: finalData[0].AccountTransferFee,
		//               timestamp: finalData[0].timestamp,
		//               txnGasFee: txngasfee,
		//             }
		//           );

		//           console.log("Transaction log updated:", updatedData);
		//           // HAS TO BE TESTED
		//           let side = "sell";
		//           let apiPath = `${baseUrl}/v1/orders/${side}`;
		//           let marketOrderResponse = await axios({
		//             method: "post",
		//             url: apiPath,
		//             headers: {
		//               Authorization: "Bearer " + req.user["userToken"],
		//             },
		//             data: {
		//               currency_pair: "ethusd",
		//               price: parseFloat(oneCryptoPrice),
		//               quantity: parseFloat(cryptoCurrencyAmount),
		//               algorithm_id: 100,
		//               client_order_id: quoteId,
		//             },
		//           });

		//           if (marketOrderResponse?.data) {
		//             setTimeout(async () => {
		//               let apiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
		//               console.log(apiPath);
		//               let marketOrderTransaction = await axios({
		//                 method: "get",
		//                 url: apiPath,
		//                 headers: {
		//                   Authorization: "Bearer " + req.user["userToken"],
		//                 },
		//                 params: {
		//                   types: "sell",
		//                   limit: 2,
		//                 },
		//               });

		//               let marketOrderFinal = [];
		//               marketOrderFinal = marketOrderTransaction?.data.filter(
		//                 (e) => e.currency === "usd" && e.client_order_id === quoteId
		//               );
		//               console.log("marketOrderFinal0", marketOrderFinal);

		//               if (marketOrderFinal.length > 0) {
		//                 let marketOrderData = await TransactionLog.update(
		//                   { id: saveData.id },
		//                   {
		//                     txnStatus: true, //
		//                     orderId: marketOrderFinal[0]?.order_id,
		//                     clientOrderId: marketOrderFinal[0]?.client_order_id,
		//                     amount: marketOrderFinal[0].amount,
		//                     price: marketOrderFinal[0].price,
		//                     fees: marketOrderFinal[0].fees,
		//                     algoName: marketOrderFinal[0]?.algo_name,
		//                     algoId: marketOrderFinal[0]?.algo_id,
		//                     accountBalance: marketOrderFinal[0].account_balance,
		//                     symbol: marketOrderFinal[0]?.symbol,
		//                     idempotencyId: marketOrderFinal[0]?.IdempotencyId,
		//                     timestamp: marketOrderFinal[0].timestamp,
		//                   }
		//                 );
		//                 console.log("marketOrderData", marketOrderData);
		//               }
		//             }, 110000);
		//           }
		//         }
		//       }
		//     }
		//   } catch (error) {
		//     console.error("Error updating transaction log:", error);
		//   }
		// }, 110000);
	} catch (error) {
		console.log(error);
		return res
			.status(responseCode.serverError)
			.json(rs.errorResponse(error.toString()));
	}
};

async function transactionHistory() {
	try {
		console.log("in the settimeout");
		let getTransactionList = await TransactionLog.scan()
			.attributes([
				"id",
				"cryptoCurrency",
				"createDate",
				"customerAddress",
				"merchantAddress",
				"clientOrderId",
				"inwardBaseAmount",
				"user_id",
				"action",
			])
			.where("txnStatus")
			.eq(false)
			.where("clientOrderId")
			.not()
			.eq(null)
			.where("action")
			.in(["deposit"])
			.exec();

		console.log(getTransactionList.count);
		if (getTransactionList.count === 0) return;

		let userIdList = Array.from(
			new Set(getTransactionList.map((e) => e.user_id))
		);

		let userTokensList = await User.scan()
			.attributes(["user_id", "userToken"])
			.where("user_id")
			.in(userIdList)
			.exec();
		console.log(userIdList);

		console.log(userTokensList);

		getTransactionList.map(async (txn) => {
			let offset = 5;
			let apiPath = `${process.env.ETHERSCAN_URL}/api?module=account&action=txlist&address=${txn.customerAddress}&startblock=0&endblock=99999999&page=1&offset=${offset}&sort=desc&apikey=${process.env.ETHERSCAN_KEY}`;
			console.log(apiPath);

			let responseEther = await axios({
				method: "get",
				url: apiPath,
			});

			if (responseEther?.data?.result.length === 0) return;

			let etherScanList = responseEther?.data?.result;

			// console.log(etherScanList);
			let scaledAmount = BigInt(
				Math.round(parseFloat(txn.inwardBaseAmount) * 1e18)
			);

			console.log(scaledAmount);
			console.log(etherScanList);
			if ("Max rate limit reached" == etherScanList) return;
			/**
			 * TypeError: etherScanList?.filter is not a function
			0|staging  |     at /home/ubuntu/hifi_backend/src/controllers/walletConnect.js:422:42
			0|staging  |     at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
			0|staging  | 
			 */
			let etherscanData = etherScanList?.filter(
				(e) =>
					e.from === txn.customerAddress &&
					e.to === txn.merchantAddress &&
					BigInt(e.value) === scaledAmount
			);

			if (etherscanData?.length === 0) return;

			console.log(etherscanData);

			let userToken = userTokensList.find((obj) => obj.user_id === txn.user_id);

			let txnApiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
			console.log(txnApiPath);

			console.log(userToken);
			let txnResponse = await axios({
				method: "get",
				url: txnApiPath,
				headers: {
					Authorization: "Bearer " + userToken.userToken,
				},
				params: {
					types: txn.action.toLowerCase(),
					limit: 5,
				},
			});

			let finalData = [];
			finalData = txnResponse?.data.filter(
				(e) => e.tx_hash === etherscanData[0].hash
			);

			console.log("finalData");
			console.log(finalData);

			if (finalData.length === 0) return;

			finalData = finalData[0];

			let txngasfee =
				parseFloat(
					BigInt(etherscanData[0].gas) * BigInt(etherscanData[0].gasPrice)
				) / 1e18;

			const updatedData = await TransactionLog.update(
				{ id: txn.id },
				{
					txId: finalData.id,
					aTxId: finalData.atxid,
					day: finalData?.day,
					action: finalData?.action.toLowerCase(),
					price: finalData?.price,
					status: finalData.status,
					txHash: finalData.tx_hash,
					accountTransferFee: finalData.AccountTransferFee,
					timestamp: finalData.timestamp,
					inwardTxnFees: txngasfee,
					txnStatus: true,
				}
			);

			if (finalData?.action.toLowerCase() === "deposit") {
				let side = "sell";
				// addd the currency pair dynamically
				let apiPath = `${baseUrl}/v1/orders/${side}`;
				let marketOrderResponse = await axios({
					method: "post",
					url: apiPath,
					headers: {
						Authorization: "Bearer " + userToken.userToken,
					},
					data: {
						currency_pair: "ethusd",
						price: parseFloat(finalData?.price),
						quantity: parseFloat(finalData?.amount),
						algorithm_id: 100,
						client_order_id: txn.clientOrderId,
					},
				});
				console.log(marketOrderResponse?.data);
			}
		});
	} catch (error) {
		console.log(error);
	}
}

// cron.schedule("*/1 * * * *", () => {
//   if (process.env.ISCRON === "TRUE") transactionHistory();
// });

async function marketOrderTransaction() {
	try {
		let getTransactionList = await TransactionLog.scan()
			.attributes([
				"id",
				"cryptoCurrency",
				"createDate",
				"customerAddress",
				"merchantAddress",
				"clientOrderId",
				"inwardBaseAmount",
				"user_id",
				"action",
				"price",
			])
			.where("txnStatus")
			.eq(true)
			.where("clientOrderId")
			.not()
			.eq(null)
			.where("marketOrderStatus")
			.eq(false)
			.where("action")
			.in(["deposit", "withdraw"])
			.exec();

		console.log("getTransactionList");
		if (getTransactionList.count === 0) return;

		let userIdList = Array.from(
			new Set(getTransactionList.map((e) => e.user_id))
		);

		let userTokensList = await User.scan()
			.attributes(["user_id", "userToken", "email"])
			.where("user_id")
			.in(userIdList)
			.exec();
		console.log(userIdList);

		console.log(userTokensList);

		getTransactionList.map(async (txn) => {
			let userToken = userTokensList.find((obj) => obj.user_id === txn.user_id);
			console.log(txn);
			let side;
			let currency;

			if (txn.action == "deposit") {
				side = "sell";
				currency = "usd";
			}

			if (txn.action == "withdraw") {
				side = "buy";
				currency = "usdc";
			}

			console.log(txn.action);

			let apiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
			console.log(apiPath);
			let marketOrderTxn = await axios({
				method: "get",
				url: apiPath,
				headers: {
					Authorization: "Bearer " + userToken.userToken,
				},
				// change the limit formula based on the side type
				params: {
					types: side,
					limit: 10,
				},
			});

			console.log(marketOrderTxn?.data);

			if (marketOrderTxn?.data.length === 0) return;

			let marketOrderFinal = [];
			marketOrderFinal = marketOrderTxn?.data.filter(
				(e) =>
					e.currency === currency && e.client_order_id === txn.clientOrderId
			);
			console.log("marketOrderFinal0", marketOrderFinal);

			if (marketOrderFinal.length > 0) {
				let MRDataObj = marketOrderFinal[0];
				let marketOrderData;
				if (txn.action == "deposit") {
					marketOrderData = await TransactionLog.update(
						{ id: txn.id },
						{
							orderId: MRDataObj?.order_id,
							clientOrderId: MRDataObj?.client_order_id,
							outwardTxnFees: MRDataObj.fees,
							algoName: MRDataObj?.algo_name,
							algoId: MRDataObj?.algo_id,
							symbol: MRDataObj?.symbol,
							idempotencyId: MRDataObj?.IdempotencyId,
							outwardTotalAmount: MRDataObj.amount,
							marketOrderStatus: true,
							withdrawStatus: true,
						}
					);

					if (marketOrderData?.email) {
						let purchaseDetails = {
							orderId: marketOrderData?.orderId,
							totalAmount: marketOrderData?.inwardBaseAmount,
							recipientName: marketOrderData?.name,
							productDescription: marketOrderData?.description,
							paymentAddress: marketOrderData?.customerAddress,
							paymentDate: marketOrderData?.createDate,
							currency: marketOrderData?.inwardCurrency,
							walletType: marketOrderData?.walletType
						};

						//  here topdf and then email service
						let pdfData = await generatePdf(purchaseDetails);

						console.log("pdfData");
						console.log(pdfData);

						let mailDetails = {
							from: `${process.env.FROM_EMAIL}`,
							to: marketOrderData?.email,
							subject: "Payment Receipt",
							fileName: "customerPReceipt.ejs",
							file: pdfData,
							text: "Payment Receipt Attachment",
						};
						await sendEmail.generateEmail(mailDetails);

						let mailDetailsMerchant = {
							from: `${process.env.FROM_EMAIL}`,
							to: userToken.email,
							subject: "Payment By Customer",
							fileName: "merchantDepositTemplate.ejs",
							text: "Payment By Customer",
						};
						await sendEmail.generateEmail({ ...mailDetailsMerchant, ...purchaseDetails });

					}
				} else if (txn.action == "withdraw") {
					marketOrderData = await TransactionLog.update(
						{ id: txn.id },
						{
							orderId: MRDataObj?.order_id,
							clientOrderId: MRDataObj?.client_order_id,
							inwardTotalAmount: MRDataObj.amount,
							price: MRDataObj?.price,
							inwardTxnFees: MRDataObj.fees,
							algoName: MRDataObj?.algo_name,
							algoId: MRDataObj?.algo_id,
							symbol: MRDataObj?.symbol,
							idempotencyId: MRDataObj?.IdempotencyId,
							marketOrderStatus: true,
							day: MRDataObj?.day,
							inwardAccountBalance: MRDataObj?.account_balance,
						}
					);

					let apiPath = `${baseUrl}/v1/user/withdraw`;
					console.log(MRDataObj.amount);
					console.log(parseFloat(MRDataObj.amount));

					let withdrawResponse = await axios({
						method: "post",
						url: apiPath,
						headers: {
							Authorization: "Bearer " + userToken.userToken,
						},
						data: {
							currency: currency,
							address: txn.customerAddress,
							amount: MRDataObj.amount,
						},
					});
					console.log(withdrawResponse?.data);

					let withdrawStatus = await TransactionLog.update(
						{ id: txn.id },
						{
							aTxId: withdrawResponse?.data?.atx_id,
						}
					);
					console.log(withdrawStatus);
				}
			}
		});
	} catch (error) {
		console.log(error);
	}
}

// cron.schedule("*/1 * * * *", () => {
// 	if (process.env.ISCRON === "TRUE") marketOrderTransaction();
// });

async function withdrawTransaction() {
	try {
		let getTransactionList = await TransactionLog.scan()
			.attributes([
				"id",
				"cryptoCurrency",
				"createDate",
				"customerAddress",
				"merchantAddress",
				"clientOrderId",
				"inwardBaseAmount",
				"user_id",
				"action",
				"price",
				"aTxId",
			])
			.where("txnStatus")
			.eq(true)
			.where("clientOrderId")
			.not()
			.eq(null)
			.where("marketOrderStatus")
			.eq(true)
			.where("aTxId")
			.not()
			.eq(null)
			.where("action")
			.eq("withdraw")
			.where("withdrawStatus")
			.eq(false)
			.exec();

		console.log(getTransactionList.count);

		if (getTransactionList.count === 0) return;
		console.log("withdrawTransaction");
		let userIdList = Array.from(
			new Set(getTransactionList.map((e) => e.user_id))
		);

		let userTokensList = await User.scan()
			.attributes(["user_id", "userToken"])
			.where("user_id")
			.in(userIdList)
			.exec();
		// Processing Automatic withdrawal
		// Started
		getTransactionList.map(async (txn) => {
			let userToken = userTokensList.find((obj) => obj.user_id === txn.user_id);

			let apiPath = `${process.env.SFOX_BASE_URL}/v1/account/transactions`;
			console.log(apiPath);
			let marketOrderTxn = await axios({
				method: "get",
				url: apiPath,
				headers: {
					Authorization: "Bearer " + userToken.userToken,
				},
				// change the limit formula based on teh side type
				params: {
					types: txn.action,
					limit: 10,
				},
			});

			console.log(txn);

			if (marketOrderTxn?.data.length === 0) return;

			let marketOrderFinal = [];
			marketOrderFinal = marketOrderTxn?.data.filter(
				(e) => e.atxid === txn.aTxId && e.status == "done"
			);

			if (marketOrderFinal.length == 0) return;

			if (marketOrderFinal.length > 0) {
				let WDataObj = marketOrderFinal[0];
				let marketOrderData;

				console.log(WDataObj);

				console.log(WDataObj?.amount + WDataObj?.fees);
				marketOrderData = await TransactionLog.update(
					{ id: txn.id },
					{
						outwardTotalAmount: -(WDataObj?.amount + WDataObj?.fees),
						outwardTxnFees: WDataObj.fees,
						outwardAccountBalance: WDataObj?.account_balance,
						outwardBaseAmount: WDataObj?.amount * -1,
						txHash: WDataObj?.tx_hash,
						timestamp: WDataObj?.timestamp,
						accountTransferFee: WDataObj?.AccountTransferFee,
						withdrawStatus: true,
						status: WDataObj?.status,
						action: "withdraw",
					}
				);
			}
		});
	} catch (error) {
		console.log(error);
	}
}

// cron.schedule("*/1 * * * *", () => {
// 	if (process.env.ISCRON === "TRUE") withdrawTransaction();
// });

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
