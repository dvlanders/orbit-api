const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const createAndFundBastionUser = require("./createAndFundBastionUser");
const submitBastionKyc = require("./submitBastionkyc");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

const UpdateBastionUserErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS"
};

class UpdateBastionUserError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, UpdateBastionUserError.prototype);
	}
}


const updateBastionUser = async(userId) => {
    try{
        // NOTE: right now there is no way to update bastion information

        // check current user status
        // check is bastion user created
        let { data: bastionWallets, error:bastionWalletsError } = await supabaseCall(() => supabase
            .from('bastion_wallets')
            .select('*')
            .eq("user_id", userId)
            .maybeSingle())
        
        if (bastionWalletsError) throw new UpdateBastionUserError(UpdateBastionUserErrorType.INTERNAL_ERROR, bastionWalletsError.message, bastionWalletsError)
        if (!bastionWallets){
            return await createAndFundBastionUser(userId)
        }

        // check is bastion kyc submitted
        let { data: bastionKyc, error: bastionKycError } = await supabaseCall(() => supabase
            .from('bastion_users')
            .select('*')
            .eq("user_id", userId)
            .maybeSingle())
        if (bastionKycError) throw new UpdateBastionUserError(UpdateBastionUserErrorType.INTERNAL_ERROR, bastionKycError.message, bastionKycError)
        if (!bastionKyc){
            return await submitBastionKyc(userId)
        }

        
        return {
            status: 200,
            message: "wallet Kyc success",
            customerStatus: "active"
        }



    
    
    }catch(error){

    }   
    
        
    
}