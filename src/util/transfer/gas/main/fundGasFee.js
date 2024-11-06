const fetch = require('node-fetch');
const { v4: uuidv4, v4 } = require("uuid");
const createLog = require('../../../logger/supabaseLogger');
const { getUserWallet, getUserWalletBalance } = require('../../../user/getUserWallet');
const { sendSlackGasStationWalletBalanceAlert } = require('../../../logger/slackLogger');		
const { insertSingleGasTransactionRecord, updateGasTransactionRecord } = require('../utils/gasTransactionTableService');
const { insertWalletTransactionRecord, getWalletColumnNameFromProvider, transferBaseAssetToWallet } = require('../../walletOperations/utils');
const { Chain } = require('../../../common/blockchain');
const { getDeveloperUserId } = require('../../../user/getDeveloperUser');
const { getUserBalanceBastion } = require('../../../bastion/main/getWalletBalance');

const HIFIgasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df' // this is the user id in bastion prod that has been prefunded with ETH to serve as gas station wallet
const HIFIgasStationWalletAddress = '0x9Bf9Bd42Eb098C3fB74F37d2A3BA8141B5785a5f'

const gasStationNotificationThreshold = {
	"ETHEREUM_MAINNET": 0.1,
	"POLYGON_MAINNET": 1
}

const currencySymbolMap = {
	"ETHEREUM_MAINNET": "ETH",
	"POLYGON_MAINNET": "MATIC"
}

const initRecord = async(config) => {
	const {sponsorUserId, chain, amount, sponsorWalletAddress, destinationWalletAddress, destinationUserId, sponsorWalletProvider} = config
	// insert record in provider table
    const toInsert = {user_id: sponsorUserId, request_id: v4()};
    const walletTxRecord = await insertWalletTransactionRecord(sponsorWalletProvider, toInsert);
    const walletColName = getWalletColumnNameFromProvider(sponsorWalletProvider);

	//insert record in gas_transactions
	const toInsertGasTransactionRecord = {
		destination_user_id: destinationUserId,
		source_wallet_address: sponsorWalletAddress,
		destination_wallet_address: destinationWalletAddress,
		amount: amount,
		chain: chain,
		status: "CREATED",
		[walletColName]: walletTxRecord.id,
		sponsor_wallet_provider: sponsorWalletProvider
	}

	if (sponsorUserId) gasTransactionRecord.sponsor_user_id = sponsorUserId
	const gasTransactionRecord = await insertSingleGasTransactionRecord(toInsertGasTransactionRecord)

	return gasTransactionRecord
}

async function fundUserGasFee(userId, amount, chain, type = "INDIVIDUAL", profileId=undefined) {
	let shouldReschedule = true
	try {
		// get user wallet
		const {address: destinationWalletAddress} = await getUserWallet(userId, chain, type)
		if (!destinationWalletAddress) throw new Error(`No user wallet found`)
		
		const sponsorshipConfig = {
			chain,
			amount,
			destinationWalletAddress,
			destinationUserId: userId,
			sponsorWalletProvider: null,
			sponsorUserId: null,
			sponsorWalletAddress: null,
			sponsorBastionUserId: null,
			sponsorCircleWalletId: null,
		}

		//  get gas station from developer user if chain is not POLYGON_MAINNET or POLYGON_AMOY
		if (chain == Chain.ETHEREUM_MAINNET) {
			shouldReschedule = false
			if (!profileId) throw new Error("Target chain is not POLYGON, should provide profileId in order to get developer user information")
			// get developer userId
			const developerUserId = await getDeveloperUserId(profileId)
			if (!developerUserId) throw new Error(`No developer user found for profile ${profileId}`)
			const {bastionUserId, walletId, address, walletProvider} = await getUserWallet(developerUserId, chain, "GAS_STATION")
			if (!address) throw new Error(`Gas station wallet not created for profile ${profileId}`) 
			sponsorshipConfig.sponsorBastionUserId = bastionUserId
			sponsorshipConfig.sponsorCircleWalletId = walletId
			sponsorshipConfig.sponsorWalletAddress = address
			sponsorshipConfig.sponsorWalletProvider = walletProvider
			sponsorshipConfig.sponsorUserId = developerUserId
			
		}else if (chain == Chain.POLYGON_MAINNET) {
			sponsorshipConfig.sponsorBastionUserId = HIFIgasStation
			sponsorshipConfig.sponsorWalletAddress = HIFIgasStationWalletAddress
			sponsorshipConfig.sponsorWalletProvider = "BASTION"
		}else{
			// do not process gas sponsor for other chains
			return {success: true}
		}

		// insert record in gas_transactions table
		const record = await initRecord(sponsorshipConfig)

		// transfer base asset to wallet
		const walletColName = getWalletColumnNameFromProvider(sponsorshipConfig.sponsorWalletProvider);
		const transferConfig = {
			referenceId: record.id, 
			senderCircleWalletId: sponsorshipConfig.sponsorCircleWalletId, 
			senderBastionUserId: sponsorshipConfig.sponsorBastionUserId,
			amountInEther: amount, 
			chain, 
			destinationAddress: destinationWalletAddress, 
			transferType: "GAS_SPONSORSHIP", 
			providerRecordId: record[walletColName]
		}
		const {response, responseBody, mainTableStatus, failedReason} = await transferBaseAssetToWallet(sponsorshipConfig.sponsorWalletProvider, transferConfig)
		// update record in gas_transactions table
		const toUpdate = {
			updated_at: new Date().toISOString(),
			status: mainTableStatus,
		}
		if (!response.ok) {
			toUpdate.failed_reason = failedReason
		}
		await updateGasTransactionRecord(record.id, toUpdate)

		let gasStationWalletBalance
		if (sponsorshipConfig.sponsorWalletAddress === HIFIgasStationWalletAddress) {
			gasStationWalletBalance = await getUserBalanceBastion(HIFIgasStation, chain, "gas");
		}else{
			gasStationWalletBalance = await getUserWalletBalance(sponsorshipConfig.sponsorUserId, chain, "gas", "GAS_STATION");
		}

		const gasStationWalletThreshold = gasStationNotificationThreshold[chain];
		const gasStationBalance = parseFloat(gasStationWalletBalance.displayBalance);
		if(gasStationBalance < gasStationWalletThreshold) {
			const currencySymbol = currencySymbolMap[chain]
			await sendSlackGasStationWalletBalanceAlert(profileId, userId, sponsorshipConfig.sponsorWalletAddress, chain, currencySymbol, gasStationBalance);
		}

		return {success: true};

	} catch (error) {
		await createLog("bastion/fundUserGasFee", userId, error.message, error)
		return {success: false, shouldReschedule}
	}
}

module.exports = fundUserGasFee;
