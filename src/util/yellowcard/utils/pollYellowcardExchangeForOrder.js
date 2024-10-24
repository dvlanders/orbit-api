const createLog = require('../../logger/supabaseLogger');
const { v4: uuidv4 } = require('uuid');
const { currencyDecimal } = require("../../common/blockchain");
const { toUnitsString } = require("../../../util/transfer/cryptoToCrypto/utils/toUnits");
const { transferToWallet, getWalletColumnNameFromProvider } = require("../../transfer/walletOperations/utils");
const { getUserWallet } = require("../../user/getUserWallet");
const { transferType } = require("../../transfer/utils/transfer");
const { updateOfframpTransactionRecord } = require('../../transfer/cryptoToBankAccount/utils/offrampTransactionsTableService');
const { updateYellowCardTransactionInfo } = require('../../yellowcard/transactionInfoService');

async function pollYellowcardExchangeForOrder(order, offrampTransactionRecord, bearerDid) {

	const { TbdexHttpClient, Rfq, Quote, Order, OrderStatus, Close, OrderInstructions } = await import('@tbdex/http-client');

	const sourceUserId = offrampTransactionRecord.user_id
	const destinationAccountId = offrampTransactionRecord.destination_account_id
	const sourceCurrency = offrampTransactionRecord.source_currency
	const destinationCurrency = offrampTransactionRecord.destination_currency
	const chain = offrampTransactionRecord.chain
	const amount = offrampTransactionRecord.amount
	const sourceWalletAddress = offrampTransactionRecord.from_wallet_address
	const walletType = offrampTransactionRecord.transfer_from_wallet_type
	const walletProvider = offrampTransactionRecord.crypto_provider

	let orderClose;
	while (!orderClose) {
		try {
			const exchange = await TbdexHttpClient.getExchange({
				pfiDid: order.metadata.to,
				did: bearerDid,
				exchangeId: order.exchangeId
			});

			for (const message of exchange) {
				if(message instanceof OrderInstructions) {
					const orderInstructions = message;
					console.log('**********order instructions:', orderInstructions)

					const requestId = uuidv4();
					const payinLink = orderInstructions.data.payin.link;
					const urlParams = new URLSearchParams(new URL(payinLink).search);
	
					const network = urlParams.get('network');
					// occurs error if network doesn't match
					if ((chain.startsWith("POLYGON") && network !== "POLYGON") || (chain.startsWith("ETHEREUM") && network !== "ERC20")) {
						await createLog("transfer/util/pollYellowcardExchangeForOrder", sourceUserId, "Network type doesn't match", orderInstructions);
						const offrampTransactionRecordToUpdate = {
							transaction_status: "NOT_INITIATED",
							failed_reason: "Network type doesn't match",
						}
						const updatedOfframpTransactionRecord = await updateOfframpTransactionRecord(offrampTransactionRecord.id, offrampTransactionRecordToUpdate)
	
						const yellowcardTransactionRecordToUpdate = {
							order_instructions_message: orderInstructions,
						}
						const updatedYellowcardTransactionRecord = await updateYellowCardTransactionInfo(offrampTransactionRecord.yellowcard_transaction_id, yellowcardTransactionRecordToUpdate)
	
						return { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord };
					}
					const yellowcardLiquidationWalletAddress = urlParams.get('walletAddress') ;
	
					// prepare the "amount" for the bastion submit user action call format
					const decimals = currencyDecimal[sourceCurrency]
					const transferAmount = toUnitsString(amount, decimals)
	
					const { bastionUserId, circleWalletId } = await getUserWallet(sourceUserId, chain, walletType);
					const providerRecordId = offrampTransactionRecord[getWalletColumnNameFromProvider(walletProvider)]
					const transferConfig = {
						referenceId: offrampTransactionRecord.id, 
						senderCircleWalletId: circleWalletId, 
						senderBastionUserId: bastionUserId,
						currency: sourceCurrency, 
						unitsAmount: transferAmount, 
						chain: chain, 
						destinationAddress: yellowcardLiquidationWalletAddress, 
						transferType: transferType.CRYPTO_TO_FIAT,
						providerRecordId
					}
					const {response: walletResponse, responseBody: walletResponseBody, failedReason: walletFailedReason, providerStatus: walletProviderStatus, mainTableStatus} = await transferToWallet(walletProvider, transferConfig)
	
					const offrampTransactionRecordToUpdate = {
						transaction_status: mainTableStatus
					}
	
					const yellowcardTransactionRecordToUpdate = {
						order_instructions_message: orderInstructions,
						payin_wallet_address: yellowcardLiquidationWalletAddress,
					}
	
					if (!walletResponse.ok) {
						// fail to transfer
						await createLog("transfer/util/pollYellowcardExchangeForOrder", offrampTransactionRecord.user_id, walletResponseBody.message, walletResponseBody);
						offrampTransactionRecordToUpdate.failed_reason = walletFailedReason
					}
	
					const updatedYellowcardTransactionRecord = await updateYellowCardTransactionInfo(offrampTransactionRecord.yellowcard_transaction_id, yellowcardTransactionRecordToUpdate);
					const updatedOfframpTransactionRecord = await updateOfframpTransactionRecord(offrampTransactionRecord.id, offrampTransactionRecordToUpdate);
	
					return { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord };

				} else if (message instanceof Close){
					const orderClose = message;
					// failed to get yellowcard order isntructions indicating failure of some kind on the yellowcard side
					console.log('**********close message:', orderClose)

					const offrampTransactionRecordToUpdate = {
						transaction_status: "NOT_INITIATED",
						failed_reason: "Order closed"
					};
					const updatedOfframpTransactionRecord = await updateOfframpTransactionRecord(offrampTransactionRecord.id, offrampTransactionRecordToUpdate)

					const yellowcardTransactionRecordToUpdate = {
						order_close_message: orderClose,
					}
					const updatedYellowcardTransactionRecord = await updateYellowCardTransactionInfo(offrampTransactionRecord.yellowcard_transaction_id, yellowcardTransactionRecordToUpdate)

					return { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord };

				}

			}

		} catch (error) {
			console.error('Error during exchange processing:', error);
			await createLog("transfer/util/pollYellowcardExchangeForOrder", offrampTransactionRecord.user_id, "Exchange processing error", error);
			return { error: "Exchange process failed", details: error };
		}
	}
}

module.exports = {
	pollYellowcardExchangeForOrder
};