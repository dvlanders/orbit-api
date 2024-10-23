const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { updateFiatToFiatRecordByRequestId } = require("../utils/fiatToFiatTransactionService");
const fetchCheckbookFiatToFiatTransferRecord = require("./fetchCheckbookFiatToFiatTransferRecord");
const { CreateFiatToFiatTransferError, CreateFiatToFiatTransferErrorType } = require("../utils/utils");
const { isValidAmount } = require("../../../common/transferValidation");
const { fetchWithLogging } = require("../../../logger/fetchLogger");

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const transferFromPlaidToBankAccount = async(configs) => {
    const {requestId, accountNumber, routingNumber, recipientName, type, sourceUserId, sourceAccountId, amount, currency, memo, profileId} = configs;

    try{
        if(!isValidAmount(amount, 1)) throw new CreateFiatToFiatTransferError(CreateFiatToFiatTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 1.")
        
        // get the checkbook account representing checkbook account from supabase
        const { data: checkbookAccount, error: checkbookAccountError } = await supabaseCall(() => supabase
            .from('checkbook_accounts')
            .select('*')
            .eq('id', sourceAccountId)
            .maybeSingle());

        if (checkbookAccountError) throw new CreateFiatToFiatTransferError(CreateFiatToFiatTransferErrorType.INTERNAL_ERROR, checkbookAccountError);
        if (!checkbookAccount) throw new CreateFiatToFiatTransferError(CreateFiatToFiatTransferErrorType.INTERNAL_ERROR, 'Checkbook account not found');

        // get the checkbook user for the account from supabase
        const { data: checkbookUser, error: checkbookUserError } = await supabaseCall(() => supabase
            .from('checkbook_users')
            .select('*')
            .eq('checkbook_user_id', checkbookAccount.checkbook_user_id)
            .maybeSingle());

        if (checkbookUserError) throw new CreateFiatToFiatTransferError(CreateFiatToFiatTransferErrorType.INTERNAL_ERROR, checkbookUserError);
        if (!checkbookUser) throw new CreateFiatToFiatTransferError(CreateFiatToFiatTransferErrorType.INTERNAL_ERROR, 'Checkbook user not found');

        const {data: initialRecord, error: initialRecordError} = await supabaseCall(() => supabase
            .from("fiat_to_fiat_transactions")
            .update({
                source_user_id: sourceUserId,
                source_account_id: sourceAccountId,
                amount: amount,
                currency: currency,
                account_number: accountNumber,
                routing_number: routingNumber,
                recipient_name: recipientName,
                source_checkbook_user_id: checkbookAccount.checkbook_user_id,
                type: type,                
                memo: memo,
                fiat_provider: "CHECKBOOK",
                fiat_receiver: "BANK",
                status: "CREATED",
            })
            .eq("request_id", requestId)
            .select()
            .single());

        if (initialRecordError) {
            await createLog("transfer/utils/transferFromPlaidToBankAccount", sourceUserId, initialRecordError.message, initialRecordError)
            throw new CreateFiatToFiatTransferError(CreateFiatToFiatTransferErrorType.INTERNAL_ERROR, initialRecordError.message)
        } 

        // execute checkbook payment
        const createDigitalPaymentUrl = `${CHECKBOOK_URL}/check/direct`;
        const body = {
            "recipient": `${checkbookUser.user_id}@hifibridge.com`,
            "account_type": type,
            "routing_number": routingNumber,
            "account_number": accountNumber,
            "name": recipientName,
            "amount": amount,
            "account": checkbookAccount.checkbook_id,
            "description": memo,
        }

        const options = {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': `${checkbookUser.api_key}:${checkbookUser.api_secret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        };

        const response = await fetchWithLogging(createDigitalPaymentUrl, options, "CHECKBOOK");
        const responseBody = await response.json();

        if (!response.ok) {
            const toUpdate = {
                checkbook_response: responseBody,
                status: "SUBMISSION_FAILED"          
            }
            await updateFiatToFiatRecordByRequestId(requestId, toUpdate);
            await createLog("transfer/util/transferFromPlaidToBankAccount", sourceUserId, responseBody.message, responseBody);
            throw new CreateFiatToFiatTransferError(CreateFiatToFiatTransferErrorType.INTERNAL_ERROR, responseBody);
        }

        const toUpdate = {
            checkbook_response: responseBody,
            status: "FIAT_SUBMITTED",
            checkbook_payment_id: responseBody.id,
            checkbook_status: responseBody.status
        }

        if (process.env.NODE_ENV === "development") {
            toUpdate.status = "CONFIRMED"
            toUpdate.checkbook_status = "PAID"
        }

        const updatedRecord = await updateFiatToFiatRecordByRequestId(requestId, toUpdate);
        const result = await fetchCheckbookFiatToFiatTransferRecord(updatedRecord.id, profileId);
        return result;
    }catch(error){
        if (!(error instanceof CreateFiatToFiatTransferError)){
            await createLog("transfer/util/transferFromPlaidToBankAccount", sourceUserId, error.message, error)
        }
        throw error
    }
}

module.exports = transferFromPlaidToBankAccount