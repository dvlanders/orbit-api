const cron = require('node-cron');
const pollBastionStatus = require('./jobs/pollBastionStatus');

// cron.schedule('0 */2 * * *', pollBastionStatus); // every 2 hours
cron.schedule('*/60 * * * * *', pollBastionStatus); // exter 60 seconds

