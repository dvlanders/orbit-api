const { transferType } = require("../../utils/transfer")
const { fetchFiatToFiatRequestInfortmaionById } = require("../utils/fiatToFiatTransactionService")
const { convertKeysToCamelCase } = require("../../../utils/object")
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchCheckbookFiatToFiatTransferRecord = async(id, profileId) => {
    const record = await fetchFiatToFiatRequestInfortmaionById(id, profileId);
    if (!record) return null;

    let { data: plaidAccount, error: plaidAccountError } = await supabaseCall(() => supabase
        .from('checkbook_accounts')
        .select('id, account_number, routing_number, bank_name')
        .eq("id", record.source_account_id)
        .single());

    if (plaidAccountError) throw plaidAccountError;

    const result = {
        transferType: transferType.FIAT_TO_FIAT,
        transferDetails: {
            id: record.id,
            requestId: record.request_id,
            sourceUserId: record.user_id,
            currency: record.currency,
            amount: record.amount,
            sourceAccountId: record.source_account_id,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.status,
            sourceUser: convertKeysToCamelCase(record.source_user.user_kyc),
            sourceAccount: convertKeysToCamelCase(plaidAccount),
            fee: null,
            failedReason: record.failed_reason,
        }
    };

    return result;
}

module.exports = fetchCheckbookFiatToFiatTransferRecord