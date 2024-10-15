const { Chain } = require("../../common/blockchain")
const { getUserWallet } = require("../../user/getUserWallet")
const { createCircleWallet } = require("./createCircleWallet")

const defaultChain = process.env.NODE_ENV === "development" ? Chain.POLYGON_AMOLY : Chain.POLYGON_MAINNET


const checkAndUpdateCircleWallet = async (userId, walletTypes) => {
    try {
        await Promise.all(walletTypes.map(async (walletType) => {
            const {address} = await getUserWallet(userId, defaultChain, walletType)
            if (!address) {
                await createCircleWallet(userId, walletType)
            }
        }))
    } catch (error) {
        await createLog("user/util/updateCircleWallet", userId, error.message, error)
    }
}

module.exports = {checkAndUpdateCircleWallet}
