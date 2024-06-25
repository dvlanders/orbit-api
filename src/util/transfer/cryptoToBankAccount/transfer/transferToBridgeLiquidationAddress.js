const { currencyContractAddress, currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const bridgeRailCheck = require("../railCheck/bridgeRailCheck");
const {getAddress} = require("ethers");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../utils/createTransfer");
const createLog = require("../../../logger/supabaseLogger");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { transferType } = require("../../utils/transfer");

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const transferToBridgeLiquidationAddress = async(requestId, userId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress) => {
    const {isExternalAccountExist, liquidationAddress, liquidationAddressId} = await bridgeRailCheck(destinationAccountId, sourceCurrency, destinationCurrency, chain)

    if (!isExternalAccountExist) return {isExternalAccountExist: false, transferResult: null}
    
    const contractAddress = currencyContractAddress[chain][sourceCurrency]

    //insert the initial record
    const { data: initialBastionTransfersInsertData, error: initialBastionTransfersInsertError } = await supabase
    .from('offramp_transactions')
    .insert({
        id: requestId,
        user_id: userId,
        amount: amount,
        chain: chain,
        from_wallet_address: getAddress(sourceWalletAddress),
        to_wallet_address: getAddress(liquidationAddress),
        to_bridge_liquidation_address_id: liquidationAddressId,
        to_bridge_external_account_id: destinationAccountId,
        transaction_status: 'NOT_INITIATED',
        contract_address: contractAddress,
        action_name: "transfer",
    })
    .select()
    .single()

    if (initialBastionTransfersInsertError) {
        console.error('initialBastionTransfersInsertError', initialBastionTransfersInsertError);
        createLog("transfer/util/transferToBridgeLiquidationAddress", userId, initialBastionTransfersInsertError.message)
        throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
    }

    //create transfer
    const decimals = currencyDecimal[sourceCurrency]
    const transferAmount = toUnitsString(amount, decimals)
    const bodyObject = {
        requestId: requestId,
        userId: userId,
        contractAddress: contractAddress,
        actionName: "transfer",
        chain: chain,
        actionParams: [
            { name: "to", value: liquidationAddress },
            { name: "value", value: transferAmount }
        ],
    };

    const url = `${BASTION_URL}/v1/user-actions`;
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${BASTION_API_KEY}`
        },
        body: JSON.stringify(bodyObject)
    };

    const response = await fetch(url, options);
	const responseBody = await response.json();

    // fail to transfer
    if (!response.ok) {
       const { error: updateError } = await supabase
       .from('offramp_transactions')
       .update({
        bastion_response: responseBody,
        bastion_transaction_status: "FAILED",
        transaction_status: "FAILED_ONCHAIN",
        })
        .match({ id: requestId })
        
        if (updateError) {
            createLog("transfer/util/transferToBridgeLiquidationAddress", userId, updateError.message)
            throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
        }

       createLog("transfer/util/transfer", userId, responseBody.message, responseBody)
       if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance"){
           throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "transfer amount exceeds balance")
       }else{
           throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, responseBody.message)
       }
   }

   const { error: updateError } = await supabase
   .from('offramp_transactions')
   .update({
        bastion_response: responseBody,
        transaction_hash: responseBody.transactionHash,
        bastion_transaction_status: responseBody.status,
        transaction_status: "SUBMITTED_ONCHAIN"
    })
    .match({ id: requestId })

    if (updateError) {
        createLog("transfer/util/transferToBridgeLiquidationAddress", userId, updateError.message)
        throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
    }
    const result = {
        transferType: transferType.CRYPTO_TO_FIAT,
        transferDetails: {
            requestId,
            userId,
            chain,
            sourceCurrency,
            amount,
            destinationCurrency,
            destinationAccountId,
            transactionHash: responseBody.transaction_hash,
            createdAt: initialBastionTransfersInsertData.created_at,
            status: "SUBMITTED_ONCHAIN",
            contractAddress: contractAddress,
        }

    }

    return {isExternalAccountExist: true, transferResult: result}

}

module.exports = transferToBridgeLiquidationAddress