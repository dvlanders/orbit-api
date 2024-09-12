const TransferType = {
	'crypto-to-fiat': 'crypto-to-fiat',
	'fiat-to-crypto': 'fiat-to-crypto',
	'crypto-to-crypto': 'crypto-to-crypto'
}


const isValidAmount = (amount, min = 0.01) => { 
    return amount && !isNaN(Number(amount)) && amount >= min;
}

const isValidLimit = (limit) => { 
    return limit && !isNaN(Number(limit)) && limit >= 0;
}

const isValidDate = (dateString) => { 
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

const isValidDateRange = (fromDateString, toDateString) => { 
    const fromDate = new Date(fromDateString);
    const toDate = new Date(toDateString);
    return !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && fromDate.getTime() <= toDate.getTime();
}

const isValidTransferType = (transferType) => {
    return transferType && Object.values(TransferType).includes(transferType);
}

module.exports = {
    isValidAmount,
    isValidLimit,
    isValidDate,
    isValidDateRange,
    isValidTransferType,
    TransferType
}