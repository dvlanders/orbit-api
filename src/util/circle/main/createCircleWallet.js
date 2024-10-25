const { v4 } = require("uuid")
const { getAllUserWallets } = require("../../bastion/utils/getAllUserWallets")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { CustomerStatus } = require("../../user/common")
const { safeParseBody } = require("../../utils/response")
const { circleChainToBlockchain } = require("../utils/chainConvert")
const { generateCypherText } = require("../utils/generateCypherText")
const { isAddress, getAddress } = require("ethers")
const { fetchWithLogging } = require("../../logger/fetchLogger")

const chainsToCreate = process.env.NODE_ENV === "development" ? ["MATIC-AMOY", "ETH-SEPOLIA", "SOL-DEVNET"] : ["MATIC", "ETH", "SOL"]


const insertWalletRecord = async (userId, walletSet, walletSetId, wallets, walletType) => {
    // insert into circle_wallets
    const toInsert = wallets.data.wallets.map((wallet) => {
        return {
                user_id: userId,
                wallet_set_id: walletSetId,
                wallet_set_response: walletSet,
                wallet_id: wallet.id,
                address: isAddress(wallet.address) ? getAddress(wallet.address) : wallet.address,
                chain: circleChainToBlockchain[wallet.blockchain],
                wallet_response: wallet,
                custody_type: wallet.custodyType,
                circle_wallet_type: wallet.accountType,
                wallet_type: walletType,
            }
        })

    const {data, error} = await supabase
        .from("circle_wallets")
        .insert(toInsert)
        .select()

    if (error) throw error

    // insert into user_wallets
    const userWalletsToInsert = data.map((wallet) => {
        return {
            user_id: userId,
            chain: wallet.chain,
            address: wallet.address,
            wallet_provider: "CIRCLE",
            wallet_type: wallet.wallet_type,
            circle_wallet_id: wallet.id,
        }
    })

    const {data: userWalletsData, error: userWalletsError} = await supabase
        .from("user_wallets")
        .insert(userWalletsToInsert)

    if (userWalletsError) throw userWalletsError

}

const createCircleWallet = async (userId, walletType="INDIVIDUAL") => {
    try{
        // create a wallet set
        const walletSetUrl = `${process.env.CIRCLE_WALLET_URL}/v1/w3s/developer/walletSets`
        const walletSetOptions = {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "Authorization": `Bearer ${process.env.CIRCLE_WALLET_API_KEY}`
            },
            body: JSON.stringify({
                "entitySecretCiphertext": generateCypherText(),
                "idempotencyKey": v4(),
                "name": `${userId}`
            })
        }
        const walletSetResponse = await fetchWithLogging(walletSetUrl, walletSetOptions, "CIRCLE")
        const walletSetResponseBody = await safeParseBody(walletSetResponse)

        if (!walletSetResponse.ok){
            await createLog("circle/createCircleWallet", userId, walletSetResponseBody.message, walletSetResponseBody)
            throw new Error("Error creating circle wallet set")
        }

        // create wallets
        const walletSetId = walletSetResponseBody.data.walletSet.id
        const walletUrl = `${process.env.CIRCLE_WALLET_URL}/v1/w3s/developer/wallets`
        const walletOptions = {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "Authorization": `Bearer ${process.env.CIRCLE_WALLET_API_KEY}`
            },
            body: JSON.stringify({
                "idempotencyKey": v4(),
                "accountType": "EOA",
                "blockchains": chainsToCreate,
                "walletSetId": walletSetId,
                "entitySecretCiphertext": generateCypherText(),
                "count": 1,
                "metadata": [{name: `userId-${userId}-${walletType}`, refId: `${userId}-${walletType}`}]
            })
        }
        const walletResponse = await fetchWithLogging(walletUrl, walletOptions, "CIRCLE")
        const walletResponseBody = await safeParseBody(walletResponse)

        // error
        if (!walletResponse.ok){
            await createLog("circle/createCircleWallet", userId, walletResponseBody.message, walletResponseBody)
            throw new Error("Error creating circle wallet")
        }
        // success insert wallet record
        await insertWalletRecord(userId, walletSetResponseBody, walletSetId, walletResponseBody, walletType)

        return {
            status: 200,
            walletStatus: CustomerStatus.ACTIVE,
            invalidFileds: [],
            actions: [],
            walletAddress: await getAllUserWallets(userId),
            message: ""
        }

    } catch (error) {
        await createLog("circle/createCircleWallet", userId, error.message, error)
        console.log(error)
        return {
			status: 500,
			walletStatus: CustomerStatus.INACTIVE,
			invalidFileds: [],
			actions: [],
			walletAddress: {},
			message: "Unexpected error happened, please contact HIFI for more information"
		}
    }
}

module.exports = { createCircleWallet }
