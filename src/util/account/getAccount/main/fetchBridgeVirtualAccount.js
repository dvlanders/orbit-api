const fetchBridgeVirtualAccountMicroDeposit = require("../../../bridge/endpoint/fetchBridgeVirtualAccountMicroDeposit");
const { virtualAccountPaymentRailToChain, chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");


const fetchBridgeVirtualAccount = async(userId, sourceCurrency, destinationCurrency, destinationChain, limit, createdBefore, createdAfter, includeMicroDeposit = true) => {
    try{
        // get virtual account info
        const {data, error} = await supabase
            .from("bridge_virtual_accounts")
            .select("created_at, id, user_id, status, source_currency, source_payment_rails, destination_currency, destination_payment_rail, destination_wallet_address, deposit_institutions_bank_name, deposit_institutions_bank_address, deposit_institutions_bank_routing_number, deposit_institutions_bank_account_number, virtual_account_id")
            .eq("user_id", userId)
            .eq("source_currency", sourceCurrency)
            .eq("destination_payment_rail", chainToVirtualAccountPaymentRail[destinationChain])
            .eq("destination_currency", destinationCurrency)
            .not("virtual_account_id", "is", null)
            .maybeSingle()
        
        if (error) throw error
        if (!data) return null

        let microDeposits = null;
        if(includeMicroDeposit){
            microDeposits = await fetchBridgeVirtualAccountMicroDeposit(userId, data.virtual_account_id, limit, createdBefore, createdAfter)
        }

        const virtualAccountInfo = {
            virtualAccountId: data.id,
            userId: data.user_id,
            paymentRails: data.source_payment_rails,
            sourceCurrency: data.source_currency,
            destinationChain: virtualAccountPaymentRailToChain[data.destination_payment_rail],
            destinationCurrency: data.destination_currency,
            destinationWalletAddress: data.destination_wallet_address,
            railStatus: data.status,
            depositInstructions: {
                bankName: data.deposit_institutions_bank_name,
                routingNumber: data.deposit_institutions_bank_routing_number,
                accountNumber: data.deposit_institutions_bank_account_number,
                bankAddress: data.deposit_institutions_bank_address
            },
        }

        if(microDeposits) virtualAccountInfo.microDeposits = microDeposits

        return virtualAccountInfo

    }catch (error){
        await createLog("account/getAccount/fetchBridgeVirtualAccount", userId, error.message, error)
        throw new Error("Something went wrong when performing fetchBridgeVirtualAccount")
    }
}

module.exports = fetchBridgeVirtualAccount