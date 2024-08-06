const supabaseSandbox = require("../sandboxSupabaseClient")

const tutorialCheckList = async(profileId, checkPoint) => {

    const currentCheckPoint = {...checkPoint}

    // check if sandboxkey is created
    if (!checkPoint.sandboxKeyCreated){
        const {data, error} = await supabaseSandbox
            .from("api_keys")
            .select("*")
            .eq('profile_id', profileId)
        if (data && data.length > 0) {
            currentCheckPoint.sandboxKeyCreated = true
        }
    }

    // check if user is created and passed all kyc
    if (!checkPoint.userCreated){
        const {data, error} = await supabaseSandbox
            .from("users")
            .select("id, bridge_customers(status), bastion_users(kyc_passed), checkbook_users(checkbook_id)")
            .eq("profile_id", profileId)


        if (data){
            for (const user of data)
            if (user && user.bridge_customers && user.checkbook_users && user.bastion_users){
                currentCheckPoint.userCreated = true
                break
            }
        }

    }


    // check if bank account is added
    if (!checkPoint.BankAccountAdded){
        const {data, error} = await supabaseSandbox
            .from("users")
            .select("id, bridge_external_accounts(id), blindpay_accounts(id), checkbook_accounts(id), circle_accounts(id)")
            .eq("profile_id", profileId)

        if (data){
            for (const user of data) {
                if (user && (user.bridge_external_accounts || user.blindpay_accounts || user.checkbook_accounts || user.circle_accounts)){
                    currentCheckPoint.BankAccountAdded = true
                    break
                }
            }
        }
    }



    // check if any transfer is made
    if (!checkPoint.transfered){
        const {data, error} = await supabaseSandbox
        .from("users")
        .select("id, crypto_to_crypto!sender_user_id(id, status), offramp_transactions!user_id(id, transaction_status), onramp_transactions!user_id(id, status)")
        .eq("profile_id", profileId)

        if (data){
            for (const user of data) {
                if (user && 
                    ((user.crypto_to_crypto.length > 0 &&  user.crypto_to_crypto[0].status == "CONFIRMED")|| 
                    (user.offramp_transactions.length > 0 &&  user.offramp_transactions[0].transaction_status == "SUBMITTED_ONCHAIN") || 
                    (user.onramp_transactions.length > 0 &&  user.onramp_transactions[0].status == "FIAT_SUBMITTED")
                )){
                    currentCheckPoint.transfered = true
                    break
                }
            }
        }
    }

    return currentCheckPoint
}


module.exports = tutorialCheckList