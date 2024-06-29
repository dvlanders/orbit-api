const cron = require('node-cron');
const pollOfframpTransactionsBastionStatus = require('./jobs/pollOfframpTransactionsBastionStatus');
const pollOfframpTransactionsBridgeStatus = require('./jobs/pollOfframpTransactionsBridgeStatus');
const pollBridgeCustomerStatus = require('./jobs/pollBridgeCustomerStatus');
const pollOnrampTransactionsCheckbookStatus = require('./jobs/pollOnrampTransactionsCheckbookStatus');
const pollBastionCryptoToCryptoTransferStatus = require('./jobs/pollCryptoToCryptoTransferStatus');
const pollWebhookRetry = require('./jobs/pollWebhookRetry');

cron.schedule('*/60 * * * * *', pollOfframpTransactionsBridgeStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOfframpTransactionsBastionStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollBridgeCustomerStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOnrampTransactionsCheckbookStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollBastionCryptoToCryptoTransferStatus); // every 60 seconds
cron.schedule('*/20 * * * * *', pollWebhookRetry);


