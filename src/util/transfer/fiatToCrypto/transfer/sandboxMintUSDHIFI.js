const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { transferType } = require("../../utils/transfer");
const bridgePlaidRailCheck = require("../railCheck/bridgePlaidRailCheck");
const { getLastBridgeVirtualAccountActivity } = require("../utils/getLastBridgeVirtualAccountActivity");
const { CreateFiatToCryptoTransferError, CreateFiatToCryptoTransferErrorType } = require("../utils/utils");
const { isValidAmount } = require("../../../common/transferValidation");
const { getMappedError } = require("../utils/errorMappings")
const { paymentProcessorContractMap } = require("../../../smartContract/approve/approveTokenBastion");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
const { getFeeConfig } = require("../../fee/utils");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { v4 } = require("uuid");
const fetchCheckbookBridgeFiatToCryptoTransferRecord = require("./fetchCheckbookBridgeFiatToCryptoTransferRecord");
const { simulateSandboxFiatToCryptoTransactionStatus } = require("../utils/simulateSandboxFiatToCryptoTransaction");
const FiatToCryptoSupportedPairFetchFunctionsCheck = require("../utils/fiatToCryptoSupportedPairFetchFunctions");
const { mintScheduleCheck } = require("../../../../../asyncJobs/sandbox/mint/scheduleCheck");
const createJob = require("../../../../../asyncJobs/createJob");
const { fetchAccountProviders } = require("../../../account/accountProviders/accountProvidersService");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const sandboxMintUSDHIFI = async(config) => {
    const {requestId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue, profileId, fiatProvider, cryptoProvider, accountInfo, feeTransactionId} = config
    try{
        if(!isValidAmount(amount, 1)) throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 1.")
        const accountInfo = await fetchAccountProviders(sourceAccountId, profileId)
        // in sandbox, for mocking we always use the virtual bank account with usdc on POLYGON_AMOY
        const transferInfo = await bridgePlaidRailCheck(accountInfo.account_id, sourceCurrency, "usdc", "POLYGON_AMOY", sourceUserId, destinationUserId)
        
        //get billing tags
        const billingTags = await getBillingTagsFromAccount(requestId, transferType.FIAT_TO_CRYPTO, sourceUserId, accountInfo)


        // insert record
        const {data: initialRecord, error: initialRecordError} = await supabaseCall(() => supabase
            .from("onramp_transactions")
            .update({
                user_id: sourceUserId,
                destination_user_id: destinationUserId,
                amount: amount,
                plaid_checkbook_id: transferInfo.plaid_checkbook_id,
                bridge_virtual_account_id: transferInfo.bridge_virtual_account_id,
                destination_checkbook_user_id: transferInfo.recipient_checkbook_user_id,
                status: "CREATED",
                fiat_provider: "CHECKBOOK",
                crypto_provider: "BRIDGE",
                source_currency: sourceCurrency,
                destination_currency: destinationCurrency,
                chain: chain,
                billing_tags_success: billingTags.success,
                billing_tags_failed: billingTags.failed,
                fee_transaction_id: feeTransactionId
            })
            .eq("request_id", requestId)
            .select()
            .single())
        if (initialRecordError) {
            await createLog("transfer/utils/sandboxMintUSDHIFI", sourceUserId, initialRecordError.message, initialRecordError)
            throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, initialRecordError.message)
        } 

        const jobConfig = {
            chain: chain,
            userId: sourceUserId,
            profileId: profileId,
            walletAddress: transferInfo.destinationWalletAddress,
            amount: amount,
            onRampRecordId: initialRecord.id
        }
        if (mintScheduleCheck("mint", jobConfig, sourceUserId, profileId)){
            await createJob("mint", jobConfig, sourceUserId, profileId)
        }

        const func = FiatToCryptoSupportedPairFetchFunctionsCheck("BRIDGE", "CHECKBOOK")
        const result = await func(initialRecord.id, profileId)

        return result

    }catch (error){
        if (! (error instanceof CreateFiatToCryptoTransferError)){
            await createLog("transfer/util/transferFromPlaidToBridge", sourceUserId, error.message, error)
        }
        throw error
    }

}

module.exports = sandboxMintUSDHIFI