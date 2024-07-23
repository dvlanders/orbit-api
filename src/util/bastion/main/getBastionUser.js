const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");
const { CustomerStatus } = require("../../user/common");
const { getAllUserWallets } = require("../utils/getAllUserWallets");
const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const GetBastionErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class GetBastionError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, GetBastionError.prototype);
	}
}


/**
 * return 
 * status: 200, 404, 500
 * walletStatus: ACTIVE, INACTIVE, PENDING
 * invalidFileds: string[],
 * actions: string[],
 * message: string
 * status 200 for successfully created object (even if kyc not passed)
 * status 404 for failed object need to call update to resubmit
 * status 500 for internal server error
 * @param {*} userId 
 * @returns 
 */

const getBastionUser = async(userId) => {
    // FIXME need bastion to provide get user kyc status endpoint



    //get status from the current database instead
    try{
        let { data: bastionUser, error: bastionUserError } = await supabaseCall(() => supabase
        .from('bastion_users')
        .select('kyc_passed, jurisdiction_check_passed, kyc_level')
        .eq("user_id", userId)
        .maybeSingle())

        if (bastionUserError) throw new GetBastionError(GetBastionErrorType.INTERNAL_ERROR, bastionUserError.message, bastionUserError)
        if (!bastionUser) throw new GetBastionError(GetBastionErrorType.RECORD_NOT_FOUND, "no bastion user found")

        if (bastionUser.kyc_passed && bastionUser.jurisdiction_check_passed){
            const walletAddress = await getAllUserWallets(userId)
            return {
                status: 200,
                walletStatus: CustomerStatus.ACTIVE,
                invalidFileds: [],
                actions: [],
                walletAddress,
                message: ""
            }
        }else{
            return {
                status: 200,
                walletStatus: CustomerStatus.INACTIVE,
                invalidFileds: ["ip_address"], // seems to only controlled by ip_address
                actions: ["update"],
                walletAddress: {},
                message: "Unsupported ip_address area"
            }
        }
    }catch (error){
        await createLog("user/util/getBastionUser", userId, error.message, error.rawResponse)
        if (error.type == GetBastionErrorType.INTERNAL_ERROR){
            return {
                status: 500,
                walletStatus: CustomerStatus.INACTIVE,
                invalidFileds: [],
                actions: [],
                walletAddress: {},
                message: "Unexpected error happened, please contact HIFI for more information"
            }
        }else if (error.type == GetBastionErrorType.RECORD_NOT_FOUND){
            return {
                status: 200,
                walletStatus: CustomerStatus.INACTIVE,
                invalidFileds: [],
                actions: ["update"],
                walletAddress: {},
                message: "please call user/update to reactivate"
            }
        }
        return {
            status: 500,
            walletStatus: CustomerStatus.INACTIVE,
            invalidFileds: [],
            actions: [],
            walletAddress: {},
            message: "Unexpected error happened, please contact HIFI for more information"
        }
    }

}



module.exports = getBastionUser