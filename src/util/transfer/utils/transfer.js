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

const transferRecordsSchemaValidator = (records) => {
    if (typeof records !== 'object' || records === null) return false;
    if (!records.hasOwnProperty('count') || !records.hasOwnProperty('records')) return false;
    if (typeof records.count !== 'number') return false;
    if (!Array.isArray(records.records)) return false;
    return true;
}

const transferRecordsAggregator = (limit = 10, ...records) => {
    const aggregatedRecords = {
        count: 0,
        records: []
    };

    records.forEach(record => {
        if (!transferRecordsSchemaValidator(record)) {
            throw new Error('Invalid records schema');
        }
        aggregatedRecords.count += record.count;
        aggregatedRecords.records.push(...record.records);
    });

    aggregatedRecords.records.sort((a, b) => new Date(b.transferDetails.createdAt) - new Date(a.transferDetails.createdAt));
    aggregatedRecords.records = aggregatedRecords.records.slice(0, limit);
    aggregatedRecords.count = aggregatedRecords.records.length;

    return aggregatedRecords;
}

module.exports = {
    transferType,
    transferObjectReconstructor,
    transferRecordsAggregator
}