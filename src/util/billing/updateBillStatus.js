const createLog = require("../logger/supabaseLogger")
const supabase = require("../supabaseClient")

exports.updateBillStatus = async(event) => {
    
    try{
        const invoiceId = event.data.object.id
        // fetch history
        const {data: billingHistory, error: billingHistoryError} = await supabase
        .from("billing_history")
        .select("stripe_response")
        .eq("stripe_invoice_id", invoiceId)
        .single()
    
        if (billingHistoryError) throw billingHistoryError
        // update 
        let toUpdate
        if (event.type == "invoice.sent"){
            toUpdate = {
                status: "UNPAID",
                stripe_response: {
                    history: [event, ...billingHistory.stripe_response.history]
                },
                updated_at: new Date().toISOString()
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
        }
        // update billing history
        if (toUpdate != undefined) {
            const {data: updatedBillingHistory, error: updatedBillingHistoryError} = await supabase
                .from("billing_history")
                .update(toUpdate)
                .eq("stripe_invoice_id", invoiceId)
    
            if (updatedBillingHistoryError) throw updatedBillingHistoryError
        }
    }catch (error){
        await createLog("billing/updateBillStatus", null, error.message, error)
        throw new Error("Something happened in updateBillStatus")
    }
}