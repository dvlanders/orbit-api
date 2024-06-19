const cron = require('node-cron');
const pollOfframpTransactionsBastionStatus = require('./jobs/pollOfframpTransactionsBastionStatus');
const pollOfframpTransactionsBridgeStatus = require('./jobs/pollOfframpTransactionsBridgeStatus');
const pollBridgeCustomerStatus = require('./jobs/pollBridgeCustomerStatus');

cron.schedule('0 */2 * * *', pollOfframpTransactionsBridgeStatus); // every 2 hours
cron.schedule('*/60 * * * * *', pollOfframpTransactionsBastionStatus); // every 60 seconds
cron.schedule('*/60 * * * * *', pollBridgeCustomerStatus); // every 60 seconds


