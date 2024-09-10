const { getAccountProviderIDWithInternalID } = require('../../account/accountProviders/accountProvidersService');

const transferType = { 
    CRYPTO_TO_CRYPTO: "CRYPTO_TO_CRYPTO",
    CRYPTO_TO_FIAT: "CRYPTO_TO_FIAT",
    FIAT_TO_CRYPTO: "FIAT_TO_CRYPTO"
}

const transferObjectReconstructor = async (transferInfo, externalAccountId = null) => {

    if(!transferInfo){
        return transferInfo;
    }

    if(transferInfo.transferType === transferType.CRYPTO_TO_FIAT){

        const internalAccountId = transferInfo?.transferDetails?.destinationAccountId;
        if(!internalAccountId){
            return transferInfo;
        }
        const currency = transferInfo.transferDetails.destinationCurrency;
        externalAccountId = externalAccountId ? externalAccountId : await getAccountProviderIDWithInternalID(internalAccountId, currency);
        transferInfo.transferDetails.destinationAccountId = externalAccountId;
        
        if(transferInfo?.transferDetails?.destinationAccount?.id){
            transferInfo.transferDetails.destinationAccount.id = externalAccountId;
        }

    }else if(transferInfo.transferType === transferType.FIAT_TO_CRYPTO){
        console.log(transferInfo)
        const internalAccountId = transferInfo?.transferDetails?.sourceAccountId;
        if(!internalAccountId){
            return transferInfo;
        }

        const currency = transferInfo.transferDetails.sourceCurrency;
        externalAccountId = externalAccountId ? externalAccountId : await getAccountProviderIDWithInternalID(internalAccountId, currency);
        transferInfo.transferDetails.sourceAccountId = externalAccountId;
        
        if(transferInfo?.transferDetails?.sourceAccount?.id){
            transferInfo.transferDetails.sourceAccount.id = externalAccountId;
        }
    }
    return transferInfo;
}

module.exports = {
    transferType,
    transferObjectReconstructor
}