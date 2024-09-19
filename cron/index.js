const cron = require('node-cron');
const pollOfframpTransactionsBastionStatus = require('./jobs/pollOfframpTransactionsBastionStatus');
const pollOfframpTransactionsBridgeStatus = require('./jobs/pollOfframpTransactionsBridgeStatus');
const pollBridgeCustomerStatus = require('./jobs/pollBridgeCustomerStatus');
const pollOnrampTransactionsCheckbookStatus = require('./jobs/pollOnrampTransactionsCheckbookStatus');
const pollBastionCryptoToCryptoTransferStatus = require('./jobs/pollBastionCryptoToCryptoTransferStatus');
const pollWebhookRetry = require('./jobs/pollWebhookRetry');
const pollCleanWebhookQueue = require('./jobs/utils/pollCleanWebhookQueue');
const pollOnrampTransactionsBridgeStatus = require('./jobs/pollOnrampTransactionsBridgeStatus');
const pollAsyncJobs = require('./jobs/pollAsyncJobs');
const pollOfframpTransactionsForCircleWireExecution = require('./jobs/pollOfframpTransactionsForCircleWireExecution');
const pollDeveloperFeeStatus = require('./jobs/pollDeveloperFeeStatus');
const pollBillingCreate = require('./jobs/pollBillingCreate');
const pollBastionGasTransaction = require('./jobs/pollBastionGasTransaction');
const pollContractAction = require('./jobs/pollContractActions');
const pollBridgeWebhookEvents = require('./jobs/pollBridgeWebhookEvents');
const pollReapWebhookEvents = require('./jobs/pollReapWebhookEvents');
const pollBlindpayReceiverStatus = require('./jobs/pollBlindpayReceiverStatus');
const pollOfframpTransactionsBlindpayStatus = require('./jobs/pollOfframpTransactionsBlindpayStatus');
const pollDeleteBridgeOfframpTransfer = require('./jobs/pollDeleteBridgeOfframpTransfer');
const pollFeeTransactionRetry = require('./jobs/pollFeeTransactionRetry');

cron.schedule('*/60 * * * * *', pollOfframpTransactionsBridgeStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollDeleteBridgeOfframpTransfer); // every 60 seconds
cron.schedule('*/20 * * * * *', pollOfframpTransactionsBastionStatus); // every 20 seconds
cron.schedule('*/60 * * * * *', pollBridgeCustomerStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOnrampTransactionsCheckbookStatus); // every 60 seconds
cron.schedule('*/20 * * * * *', pollBastionCryptoToCryptoTransferStatus); // every 20 seconds
cron.schedule('*/20 * * * * *', pollContractAction); // every 20 seconds
cron.schedule('*/60 * * * * *', pollBastionGasTransaction); // every 60 seconds
cron.schedule('*/20 * * * * *', pollWebhookRetry);
cron.schedule('0 0 * * *', pollCleanWebhookQueue); // every 24 hrs
cron.schedule('*/60 * * * * *', pollOnrampTransactionsBridgeStatus)
cron.schedule('*/10 * * * * *', pollAsyncJobs)
cron.schedule('*/60 * * * * *', pollDeveloperFeeStatus)
cron.schedule('*/60 * * * * *', pollOfframpTransactionsForCircleWireExecution); // every 60 seconds
cron.schedule('0 10 * * *', pollBillingCreate) // every day at 10 AM
cron.schedule('*/60 * * * * *', pollBridgeWebhookEvents) // every 60 seconds
cron.schedule('*/60 * * * * *', pollReapWebhookEvents) // every 60 seconds
cron.schedule('*/60 * * * * *', pollBlindpayReceiverStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOfframpTransactionsBlindpayStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollFeeTransactionRetry); // every 60 seconds
