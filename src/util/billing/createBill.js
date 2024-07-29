const { getNextCycleEnd } = require('../helper/dateTimeUtils');
const createLog = require('../logger/supabaseLogger');
const supabase = require('../supabaseClient');
const { calculateCustomerMonthlyBill } = require('./customerBillCalculator');

const STRIPE_SK_KEY = process.env.STRIPE_TEST_SK_KEY
const stripe = require('stripe')(STRIPE_SK_KEY);

exports.createStripeBill = async(billingInformation) => {
    try{
        const customerId = billingInformation.stripe_customer_id
        if (!customerId) throw new Error(`Stripe customer for profileId: ${billingInformation.profile_id} is not created`)
        const billable = billingInformation.billable
        if (!billable) return 

        // check if billing is already created
        const {data: billingHistoryCheck, error: billingHistoryCheckError} = await supabase
            .from("billing_history")
            .select("id")
            .eq("profile_id", billingInformation.profile_id)
            .eq("billing_period_start", billingInformation.next_billing_period_start)
            .eq("billing_period_end", billingInformation.next_billing_period_end)
            .maybeSingle()

        if (billingHistoryCheckError) throw billingHistoryCheckError
        if (billingHistoryCheck) throw new Error(`Billing record for profileId: ${billingInformation.profile_id} for period: ${billingInformation.next_billing_period_start} to ${billingInformation.next_billing_period_end} is already created, recordId: ${billingHistoryCheck.id}`)

        // calculate fee
        const billingInfo = await calculateCustomerMonthlyBill(billingInformation.profile_id, billingInformation.next_billing_period_start, billingInformation.next_billing_period_end)
        const billablePayoutFee = parseFloat((billingInfo.cryptoPayout.value + billingInfo.fiatPayout.value).toFixed(2))
        const billableDepositFee = parseFloat(billingInfo.fiatDeposit.value.toFixed(2))
        const billableVirtualAccountFee = parseFloat(billingInfo.virtualAccount.value.toFixed(2))
        const monthlyMinimum = parseFloat(billingInfo.monthlyMinimum.toFixed(2))
        const billableIntegrationFee = Math.max(monthlyMinimum - (billablePayoutFee + billableDepositFee + billableVirtualAccountFee), 0)
        const finalBillableFee = Math.max(billablePayoutFee + billableDepositFee + billableVirtualAccountFee, monthlyMinimum)

        // insert billing history
        const {data: billingHistory, error: billingHistoryError} = await supabase
            .from("billing_history")
            .insert({
                profile_id: billingInformation.profile_id,
                crypto_payout_fee_percent: billingInformation.crypto_payout_fee_percent,
                monthly_minimum: billingInformation.monthly_minimum,
                active_virtual_account_fee: billingInformation.active_virtual_account_fee,
                fiat_payout_config: billingInformation.fiat_payout_config,
                fiat_deposit_config: billingInformation.fiat_deposit_config,
                billing_period_start: billingInformation.next_billing_period_start,
                billing_period_end: billingInformation.next_billing_period_end,
                billable_payout_fee: billablePayoutFee,
                billable_deposit_fee: billableDepositFee,
                billable_active_virtual_account_fee: billableVirtualAccountFee,
                billable_integration_fee: billableIntegrationFee,
                final_billable_fee_amount: finalBillableFee,
                status: "CREATED",
                provider: "STRIPE",
            })
            .select("id")
            .single()
        
        
        if (billingHistoryError) throw billingHistoryError

        // send invoice
        // Create an Invoice
        const invoice = await stripe.invoices.create({
            customer: customerId,
            collection_method: 'send_invoice',
            days_until_due: 30,
        });
        const invoiceId = invoice.id

        // create invoice items
        const products = [
            {productName: "deposit_fee", fee: billableDepositFee}, 
            {productName: "payout_fee", fee: billablePayoutFee}, 
            {productName: "active_virtual_account_fee", fee: billableVirtualAccountFee}, 
            {productName: "integration_fee", fee: billableIntegrationFee}, 
        ]
        console.log(products)
        await Promise.all(products.map(async(product) => {
            // get stripe product id
            const {data: productId, error: productIdError} = await supabase
                .from("stripe_product_id")
                .select("product_id")
                .eq("name", product.productName)
                .single()

            if (productIdError) throw productIdError

            // insert invoice item
            const invoiceItem = await stripe.invoiceItems.create({ 
                customer: customerId,
                price_data: {
                    currency: "usd",
                    product: productId.product_id,
                    unit_amount: Math.floor(product.fee * 100)
                },
                invoice: invoiceId
            });


        }))


        const sentInvoice = await stripe.invoices.sendInvoice(invoiceId);

        // update billing history
        const {data: updatedBillingHistory, error: updatedBillingHistoryError} = await supabase
            .from("billing_history")
            .update({
                stripe_invoice_id: invoiceId,
                billing_documentation_url: sentInvoice.invoice_pdf,
                hosted_billing_page_url: sentInvoice.hosted_invoice_url,
                stripe_response: {
                    history: [sentInvoice]
                },
                billing_email: sentInvoice.customer_email
            })
            .eq("id", billingHistory.id)
        
        if (updatedBillingHistoryError) throw updatedBillingHistoryError

        // update next billing cycle
        const nextBillingStart = billingInformation.next_billing_period_end
        const nextBillingEnd = getNextCycleEnd(nextBillingStart)

        const {data: updateBillingInformation, error: updateBillingInformationError} = await supabase
            .from("billing_information")
            .update({
                next_billing_period_start: nextBillingStart,
                next_billing_period_end: nextBillingEnd
            })
            .eq("profile_id", billingInformation.profile_id)
        return 


    }catch (error){
        // await createLog("billing/createStripeBill", null, error.message, error, billingInformation.profile_id)
        console.error(error)
        throw new Error("Something went wrong in createStripeBill")
    }
}