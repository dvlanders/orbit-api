const supabase = require("../supabaseClient");
const { sendSlackTransactionMessage } = require("./slackLogger");
const { rampTypes } = require("../transfer/utils/ramptType")
const { getUserBalance } = require("../bastion/endpoints/getUserBalance");

const transactionDbMap = {
    [rampTypes.ONRAMP]: "onramp_transactions",
    [rampTypes.OFFRAMP]: "offramp_transactions",
    [rampTypes.CRYPTOTOCRYPTO]: "crypto_to_crypto",
}

const getOnrampAccountInfo = async (transactionRecord) => {
    const { data: checkbookAccountId, error: checkbookAccountIdError } = await supabase
        .from("checkbook_accounts")
        .select("id")
        .eq("user_id", transactionRecord.user_id)
        .eq("connected_account_type", "PLAID")
        .single();
    if (checkbookAccountIdError || !checkbookAccountId) {
        throw new Error("Failed to fetch checkbook account")
    }

    const { data: accountInfo, error: accountInfoError } = await supabase
        .from("account_providers")
        .select("*")
        .eq("user_id", transactionRecord.user_id)
        .eq("account_id", checkbookAccountId.id)
        .single();
    if (accountInfoError || !accountInfo) {
        throw new Error("failed to fetch accountProvider data");
    }

    return accountInfo;
}

const getOfframpAccountInfo = async (transactionRecord) => {
    const { data: accountInfo, error: accountInfoError } = await supabase
        .from("account_providers")
        .select("*")
        .eq("id", transactionRecord.destination_account_id)
        .single()

    if (accountInfoError || !accountInfo) {
        throw new Error("Failed to fetch accountProvider data");
    }

    return accountInfo;
}

const getCryptoToCryptoAccountInfo = async (transactionRecord) => {
    return { payment_rail: transactionRecord.chain };
}

const getAccountInfoFunctionMap = {
    [rampTypes.ONRAMP]: getOnrampAccountInfo,
    [rampTypes.OFFRAMP]: getOfframpAccountInfo,
    [rampTypes.CRYPTOTOCRYPTO]: getCryptoToCryptoAccountInfo,
}

async function notifyTransaction(userId, rampType, transactionId, messageJson) {
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

    const { data: transactionRecord, error: transactionRecordError } = await supabase
        .from(transactionDbMap[rampType])
        .select("*")
        .eq("id", transactionId)
        .single()
    if (transactionRecordError || !transactionRecord) {
        throw new Error("Failed to fetch transaction data");
    }

    const accountInfo = await getAccountInfoFunctionMap[rampType](transactionRecord);

    // const messageJson = { message }
    // const walletResponse = await getUserBalance(userId, transactonRecord.chain);
    // const walletResponseBody = await walletResponse.json()

    // if (walletResponse.ok) {
    //     messageJson["sourceWalletInfo"] = walletResponseBody;
    // }

    // console.log({userData, profileEmail, transactonRecord})

    await sendSlackTransactionMessage(profileEmail.email, userData.profile_id, userId, rampType, transactionRecord, accountInfo, messageJson);
}

module.exports = notifyTransaction;