const cron = require('node-cron');
const pollOfframpTransactionsBastionStatus = require('./jobs/pollOfframpTransactionsBastionStatus');
const pollOfframpTransactionsBridgeStatus = require('./jobs/pollOfframpTransactionsBridgeStatus');
const pollBridgeCustomerStatus = require('./jobs/pollBridgeCustomerStatus');
const pollOnrampTransactionsCheckbookStatus = require('./jobs/pollOnrampTransactionsCheckbookStatus');
const pollBastionCryptoToCryptoTransferStatus = require('./jobs/pollBastionCryptoToCryptoTransferStatus');
const pollWebhookRetry = require('./jobs/pollWebhookRetry');
const pollCleanWebhookQueue = require('./jobs/utils/pollCleanWebhookQueue');
const pollOnrampTransactionsBridgeStatus = require('./jobs/pollOnrampTransactionsBridgeStatus');

cron.schedule('*/60 * * * * *', pollOfframpTransactionsBridgeStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOfframpTransactionsBastionStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollBridgeCustomerStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOnrampTransactionsCheckbookStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollBastionCryptoToCryptoTransferStatus); // every 60 seconds
cron.schedule('*/20 * * * * *', pollWebhookRetry);
cron.schedule('0 0 * * *', pollCleanWebhookQueue); // every 24 hrs
cron.schedule('*/60 * * * * *', pollOnrampTransactionsBridgeStatus)


