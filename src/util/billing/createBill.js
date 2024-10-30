const { v4 } = require('uuid');
const { getNextCycleEnd } = require('../helper/dateTimeUtils');
const createLog = require('../logger/supabaseLogger');
const supabase = require('../supabaseClient');
const { calculateCustomerMonthlyBill } = require('./customerBillCalculator');
const { getTotalBalanceTopups, insertBalanceTopupRecord, topupBalance } = require('./balance/balanceService');
const { BalanceTopupStatus, BalanceTopupType, generateHIFICreditId } = require('./balance/utils');

const STRIPE_SK_KEY = process.env.STRIPE_SK_KEY
const stripe = require('stripe')(STRIPE_SK_KEY);

function generateHifiInvoiceId(length = 10) {
    const uuid = v4().replace(/-/g, ''); // Remove hyphens to get a continuous string
    return "HIFI_in_" + uuid.slice(0, length); // Truncate to the desired length
  }

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
        const totalTopUps = parseFloat(billingInfo.totalTopUps.toFixed(2))
        const monthlyMinimum = parseFloat(billingInfo.monthlyMinimum.toFixed(2))
        const balanceLeft = parseFloat(billingInfo.balance.balanceLeft.toFixed(2))
        const debt = (balanceLeft < 0 ? Math.abs(balanceLeft) : 0) + billingInfo.totalTransactionFeeFailed
        const transactionFeeFailedToChargedOrMinimum = parseFloat((Math.max(Math.max(monthlyMinimum - totalTopUps, 0), debt).toFixed(2)))
        
        // service fee
        const billableVirtualAccountFee = parseFloat(billingInfo.virtualAccount.value.toFixed(2))
        const integrationFee = parseFloat(billingInfo.integrationFee.toFixed(2))
        const platformFee = parseFloat(billingInfo.platformFee.toFixed(2))
        const kycKybFee = parseFloat(billingInfo.kycKyb.value.toFixed(2))
        const activeUserFee = parseFloat(billingInfo.activeUser.value.toFixed(2))


        const finalBillableFee = transactionFeeFailedToChargedOrMinimum + integrationFee + platformFee + billableVirtualAccountFee + kycKybFee + activeUserFee
        const hifiBillingId = generateHifiInvoiceId()

        // insert billing history
        const {data: billingHistory, error: billingHistoryError} = await supabase
            .from("billing_history")
            .insert({
                profile_id: billingInformation.profile_id,
                hifi_billing_id: hifiBillingId,
                crypto_payout_fee_percent: billingInformation.crypto_payout_fee_percent,
                monthly_minimum: billingInformation.monthly_minimum,
                active_virtual_account_fee: billingInformation.active_virtual_account_fee,
                fiat_payout_config: billingInformation.fiat_payout_config,
                fiat_deposit_config: billingInformation.fiat_deposit_config,
                billing_period_start: billingInformation.next_billing_period_start,
                billing_period_end: billingInformation.next_billing_period_end,
                billable_payout_fee: 0,
                billable_deposit_fee: 0,
                billable_active_virtual_account_fee: billableVirtualAccountFee,
                billable_integration_fee: integrationFee,
                billable_platform_fee: platformFee,
                fee_to_minimum: transactionFeeFailedToChargedOrMinimum,
                final_billable_fee_amount: finalBillableFee,
                status: "CREATED",
                provider: "STRIPE",
            })
            .select("id")
            .single()
        
        if (billingHistoryError) throw billingHistoryError

        // send invoice
        // Create an Invoice
        const createConfig = {
            customer: customerId,
            metadata:{
                hifiInternalBillingId: billingHistory.id,
                hifiBillingId
            }
        }
        if (billingInformation.stripe_default_payment_method_id){
            // auto charge
            createConfig.default_payment_method = billingInformation.stripe_default_payment_method_id,
            createConfig.collection_method = 'charge_automatically'
        }else{
            // send invoice reqyest
            createConfig.collection_method = 'send_invoice',
            createConfig.days_until_due = 30
        }
        const invoice = await stripe.invoices.create(createConfig);
        const invoiceId = invoice.id

        // create invoice items
        const products = [
            {productName: "active_virtual_account_fee", fee: billableVirtualAccountFee}, 
            {productName: "integration_fee", fee: integrationFee}, 
            {productName: "account_minimum", fee: transactionFeeFailedToChargedOrMinimum}, 
            {productName: "platform_fee", fee: platformFee}, 
            {productName: "kyc_kyb_fee", fee: kycKybFee}, 
            {productName: "active_user_fee", fee: activeUserFee}, 
        ]

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

        let sentInvoice
        if (!billingInformation.stripe_default_payment_method_id){
            sentInvoice = await stripe.invoices.sendInvoice(invoiceId);
        }else{
            sentInvoice = await stripe.invoices.pay(invoiceId);
        }

        const toUpdate = {
            stripe_invoice_id: invoiceId,
            billing_documentation_url: sentInvoice.invoice_pdf,
            hosted_billing_page_url: sentInvoice.hosted_invoice_url,
            stripe_response: {
                history: [sentInvoice]
            },
            billing_email: sentInvoice.customer_email,
            status: sentInvoice.paid? "PAID" : "UNPAID",
            stripe_payment_id: sentInvoice.payment_intent,
            updated_at: new Date().toISOString()
        }
        // update billing history
        const {data: updatedBillingHistory, error: updatedBillingHistoryError} = await supabase
            .from("billing_history")
            .update(toUpdate)
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
        if (updateBillingInformationError) throw updateBillingInformationError

        // reset balance to zero if user have debet
        if (billingInfo.balance.balanceLeft < 0) {
            const toInsert = {
                stripe_invoice_id: invoiceId,
                profile_id: billingInformation.profile_id,
                balance_id: billingInfo.balance.id,
                amount: Math.abs(billingInfo.balance.balanceLeft),
                status: BalanceTopupStatus.CREATED,
                type: BalanceTopupType.MONTHLY_RESET,
                hifi_credit_id: generateHIFICreditId()
              }
          
            const topupRecord = await insertBalanceTopupRecord(toInsert);
            await topupBalance(toInsert.profile_id, toInsert.amount, topupRecord.id, sentInvoice.invoice_pdf);
        }


        return 


    }catch (error){
        await createLog("billing/createStripeBill", null, error.message, error, billingInformation.profile_id)
        throw new Error("Failed to create bill")
    }
}