const { flushLogs } = require('./grafana/grafanaLogger');

const gracefulShutdown = async () => {
    try {
        await flushLogs();
    } catch (error) {
        console.error('Error flushing logs during shutdown:', error);
    } finally {
        process.exit(0);
    }
};

module.exports = {
    gracefulShutdown
};