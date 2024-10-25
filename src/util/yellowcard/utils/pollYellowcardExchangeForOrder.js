const createLog = require('../../logger/supabaseLogger');
const { v4: uuidv4 } = require('uuid');
const { currencyDecimal } = require("../../common/blockchain");
const { toUnitsString } = require("../../../util/transfer/cryptoToCrypto/utils/toUnits");
const { transferToWallet, getWalletColumnNameFromProvider } = require("../../transfer/walletOperations/utils");
const { getUserWallet } = require("../../user/getUserWallet");
const { transferType } = require("../../transfer/utils/transfer");
const { updateOfframpTransactionRecord } = require('../../transfer/cryptoToBankAccount/utils/offrampTransactionsTableService');
const { updateYellowCardTransactionInfo } = require('../../yellowcard/transactionInfoService');
const { yellowcardNetworkToChain } = require('./utils');
const notifyCryptoToFiatTransfer = require('../../../../webhooks/transfer/notifyCryptoToFiatTransfer');

async function getYellowCardDepositInstruction(order, offrampTransactionRecord, bearerDid) {

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
	const yellowcardTransactionRecordId = offrampTransactionRecord.yellowcard_transaction_record_id

	let orderClose;
	let timeout = 0;
	while (timeout < 100) {
		try {
			const exchange = await TbdexHttpClient.getExchange({
				pfiDid: order.metadata.to,
				did: bearerDid,
				exchangeId: order.exchangeId
			});

			const orderInstructions = exchange.find(message => message instanceof OrderInstructions);
			const close = exchange.find(message => message instanceof Close);

			// if order instructions found
			if (orderInstructions) {
				const payinLink = orderInstructions.data.payin.link;
				const urlParams = new URLSearchParams(new URL(payinLink).search);
				const network = urlParams.get('network');
				const yellowcardLiquidationWalletAddress = urlParams.get('walletAddress') ;

				// no network or wallet address found in the order instructions
				if (!network || !yellowcardLiquidationWalletAddress) {
					throw new Error("No network or wallet address found in the order instructions")
				}
				const chain = yellowcardNetworkToChain[network];
				// no chain found for the network
				if (!chain) {
					throw new Error(`No chain found for the network: ${network}`)
				}
				// chain doesn't match
				if (chain !== offrampTransactionRecord.chain) {
					throw new Error(`Network type doesn't match`)
				}

				// update provider record 
				const yellowcardTransactionRecordToUpdate = {
					order_instructions_message: orderInstructions,
					payin_wallet_address: yellowcardLiquidationWalletAddress,
				}
				await updateYellowCardTransactionInfo(yellowcardTransactionRecordId, yellowcardTransactionRecordToUpdate)
				// return deposit address
				return {
					chain: chain,
					liquidationAddress: yellowcardLiquidationWalletAddress
				}
			}

			// if order is closed
			if (close) {
				throw new Error(`Order for offramp transaction id: ${offrampTransactionRecord.id} is closed`)
			}

			// wait for 2 seconds before next poll
			await new Promise(resolve => setTimeout(resolve, 2000));
			timeout += 2;

			throw new Error(`Order for offramp transaction id: ${offrampTransactionRecord.id} is not closed or not received any instructions after 100 seconds`)

		} catch (error) {
			await createLog("transfer/util/pollYellowcardExchangeForOrder", offrampTransactionRecord.user_id, error.message, error);
			const offrampTransactionRecordToUpdate = {
				transaction_status: "NOT_INITIATED",
				failed_reason: "Unable to process transaction, please reach out for more information",
			}
			const updatedOfframpTransactionRecord = await updateOfframpTransactionRecord(offrampTransactionRecord.id, offrampTransactionRecordToUpdate)
			await notifyCryptoToFiatTransfer(updatedOfframpTransactionRecord)
			throw new Error(`Failed fetch yellowcard deposit instruction: ${error.message}`)
		}
	}
}

module.exports = {
	getYellowCardDepositInstruction
};