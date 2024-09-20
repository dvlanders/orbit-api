const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { autopay } = require("../../src/util/billing/payments");

const updateStatus = async (balanceInfo) => {

	try {
        console.log('Checking for autopay for profile:', balanceInfo.profile_id);
        const balance = balanceInfo.balance;
        const billingInfo = balanceInfo.billing_information;
        const balanceAutopayMin = billingInfo.monthly_minimum * billingInfo.autopay_threshold;

        if(billingInfo.autopay && balanceAutopayMin && balance < balanceAutopayMin){
            const refillAcountToReachThreshold = Math.ceil((balanceAutopayMin - balance) / billingInfo.autopay_amount);
            console.log(refillAcountToReachThreshold)
            await autopay(balanceInfo.profile_id, balanceInfo.id, refillAcountToReachThreshold * billingInfo.autopay_amount);
        }
	} catch (error) {
		await createLog('pollAutopayRefill/updateStatus', null, `Failed to check for autopay for profile:${balanceInfo.profile_id} `, error);
	}
}

async function pollAutopayRefill() {
	try {
        console.log('Polling for autopay refill');
		// TODO: Uncomment below line prior to merging
        // if(process.env.NODE_ENV === "development") return;
		const { data: balanceInfos, error: balanceInfosError } = await supabaseCall(() => supabase
			.from('balance')
            .select('*, billing_information!inner(autopay, monthly_minimum, autopay_threshold, autopay_amount)')
            .eq('billing_information.autopay', true));


		if (balanceInfosError) {
			console.error('Failed to fetch balance info for pollAutopayRefill', balanceInfosError);
			await createLog('pollAutopayRefill', null, 'Failed to fetch balance info', balanceInfosError);
			return;
		}

		await Promise.all(balanceInfos.map(async (balanceInfo) => await updateStatus(balanceInfo)))
	} catch (error) {
		await createLog("pollAutopayRefill", null, "Failed to poll balance info", error.message)
	}
}

module.exports = pollAutopayRefill;