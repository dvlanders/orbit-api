const cron = require('node-cron');
const pollOfframpTransactionsBridgeStatus = require('./jobs/pollOfframpTransactionsBridgeStatus');
const pollBridgeCustomerStatus = require('./jobs/pollBridgeCustomerStatus');
const pollOnrampTransactionsCheckbookStatus = require('./jobs/pollOnrampTransactionsCheckbookStatus');
const pollCryptoToCryptoTransferStatus = require('./jobs/pollCryptoToCryptoTransferStatus');
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
const pollOfframpTransactionsYellowcardStatus = require('./jobs/pollOfframpTransactionsYellowcardStatus');
const pollDeleteBridgeOfframpTransfer = require('./jobs/pollDeleteBridgeOfframpTransfer');
const pollFeeTransactionRetry = require('./jobs/pollFeeTransactionRetry');
const pollAutopayRefill = require('./jobs/pollAutopayRefill');
const pollBastionBaseAssetTransferStatus = require('./jobs/pollBastionBaseAssetTransferStatus');
const pollFiatToFiatCheckbookStatus = require('./jobs/pollFiatToFiatCheckbookStatus');
const pollStripeWebhookEvents = require('./jobs/pollStripeWebhookEvents');
const pollOfframpTransactionsCryptoStatus = require('./jobs/pollOfframpTransactionsCryptoStatus');

cron.schedule('*/10 * * * * *', pollOfframpTransactionsBridgeStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollDeleteBridgeOfframpTransfer); // every 60 seconds
cron.schedule('*/10 * * * * *', pollOfframpTransactionsCryptoStatus); // every 20 seconds
cron.schedule('*/60 * * * * *', pollBridgeCustomerStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollOnrampTransactionsCheckbookStatus); // every 60 seconds
cron.schedule('*/20 * * * * *', pollCryptoToCryptoTransferStatus); // every 20 seconds
cron.schedule('*/20 * * * * *', pollContractAction); // every 20 seconds
cron.schedule('*/60 * * * * *', pollBastionGasTransaction); // every 60 seconds
cron.schedule('*/20 * * * * *', pollWebhookRetry);
cron.schedule('*/20 * * * * *', pollBastionBaseAssetTransferStatus);
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
cron.schedule('*/60 * * * * *', pollOfframpTransactionsYellowcardStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollFeeTransactionRetry); // every 60 seconds
cron.schedule('*/60 * * * * *', pollAutopayRefill); // every 60 seconds
cron.schedule('*/60 * * * * *', pollFiatToFiatCheckbookStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollStripeWebhookEvents); // every 60 seconds