const { createStripeBill } = require("../../src/util/billing/createBill")
const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")

const pollBillingCreate = async() => {
    try{
        if (process.env.NODE_ENV != "production") return
        // get all billable customers
        const {data: customers, error: customersError} = await supabase
            .from("billing_information")
            .select("*")
            .eq("billable", true)
            .lt("next_billing_period_end", new Date().toISOString())
        // console.log(customers)
        // create Bill
        await Promise.all(customers.map(async(customer) => {
            try{
                await createStripeBill(customer)
            }catch (error){
                await createLog("cron/pollBillingCreate", null, error.message, error, customer.profile_id)
            }
        }))

    }catch (error){
        await createLog("cron/pollBillingCreate", null, error.message, error)
    }
}

module.exports = pollBillingCreate