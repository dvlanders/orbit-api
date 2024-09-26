const createLog = require("../logger/supabaseLogger")
const supabase = require("../supabaseClient")

exports.updateBillStatus = async(event) => {
    
    try{
        const hifiInternalBillingId = event.data.object.metadata.hifiInternalBillingId
        if (!hifiInternalBillingId) return
        // fetch history
        const {data: billingHistory, error: billingHistoryError} = await supabase
        .from("billing_history")
        .select("stripe_response, status")
        .eq("id", hifiInternalBillingId)
        .maybeSingle()
        
        if (billingHistoryError) throw billingHistoryError
        if (!billingHistory) return
        // update 
        let toUpdate
        if (event.type == "invoice.sent" && billingHistory.status != "PAID"){
            toUpdate = {
                status: "UNPAID",
                stripe_response: {
                    history: [event, ...billingHistory.stripe_response.history]
                },
                updated_at: new Date().toISOString(),
                billing_due_date: new Date(event.data.object.due_date * 1000).toISOString()
            }
        }else if (event.type == "invoice.paid" && event.data.object.paid ){
            toUpdate = {
                status: "PAID",
                stripe_response: {
                    history: [event, ...billingHistory.stripe_response.history]
                },
                stripe_payment_id: event.data.object.payment_intent,
                updated_at: new Date().toISOString(),
            }
        }else {
            return
        }
        // update billing history
        if (toUpdate != undefined) {
            const {data: updatedBillingHistory, error: updatedBillingHistoryError} = await supabase
                .from("billing_history")
                .update(toUpdate)
                .eq("id", hifiInternalBillingId)
    
            if (updatedBillingHistoryError) throw updatedBillingHistoryError
        }
    }catch (error){
        await createLog("billing/updateBillStatus", null, error.message, error)
        throw new Error("Something happened in updateBillStatus")
    }
}