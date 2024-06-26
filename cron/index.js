const cron = require('node-cron');
const pollOfframpTransactionsBastionStatus = require('./jobs/pollOfframpTransactionsBastionStatus');
const pollOfframpTransactionsBridgeStatus = require('./jobs/pollOfframpTransactionsBridgeStatus');
const pollBridgeCustomerStatus = require('./jobs/pollBridgeCustomerStatus');
const pollOnrampTransactionsCheckbookStatus = require('./jobs/pollOnrampTransactionsCheckbookStatus');
const pollCryptoToCryptoTransferStatus = require('./jobs/pollCryptoToCryptoTransferStatus');

cron.schedule('*/60 * * * * *', pollOfframpTransactionsBridgeStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOfframpTransactionsBastionStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollBridgeCustomerStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOnrampTransactionsCheckbookStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollCryptoToCryptoTransferStatus); // every 60 seconds


