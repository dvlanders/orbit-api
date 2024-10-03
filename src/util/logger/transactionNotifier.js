const supabase = require("../supabaseClient");
const { sendSlackTransactionMessage } = require("./slackLogger");
const { rampTypes } = require("../transfer/utils/ramptType")
const { getUserBalance } = require("../bastion/endpoints/getUserBalance")

const transactionDbMap = {
    [rampTypes.ONRAMP]: "onramp_transactions",
    [rampTypes.OFFRAMP]: "offramp_transactions",
    [rampTypes.CRYPTOTOCRYPTO]: ""
}

async function notifyTransaction(userId, rampType, transactionId, message) {
    const { data: userData, error: userError } = await supabase
        .from("users")
        .select(
            "profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)"
        )
        .eq("id", userId)
        .single();
    if (userError || !userData) {
        throw new Error("Failed to fetch user data");
    }
    // console.log(userData)
    const { data: profileEmail, error: profileEmailError } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userData.profile_id)
        .single();
    if (profileEmailError) {
        throw new Error("Failed to fetch profile data");
    }

    const { data: transactonRecord, error: transactionRecordError } = await supabase
        .from(transactionDbMap[rampType])
        .select("*")
        .eq("id", transactionId)
        .single()
    if (transactionRecordError || !transactonRecord) {
        throw new Error("Failed to fetch transaction data");
    }

    // const messageJson = { message }
    // const walletResponse = await getUserBalance(userId, transactonRecord.chain);
    // const walletResponseBody = await walletResponse.json()

    // if (walletResponse.ok) {
    //     messageJson["sourceWalletInfo"] = walletResponseBody;
    // }

    // console.log({userData, profileEmail, transactonRecord})

    await sendSlackTransactionMessage(profileEmail.email, userData.profile_id, userId, rampType, transactonRecord, message);
}

module.exports = notifyTransaction;