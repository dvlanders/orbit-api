const { flushLogs } = require('../../src/util/grafana/grafanaLogger')

const flushThirdPartyApiLogs = async () => {
    try{
        await flushLogs();
    }catch (error){
        console.error("Error flushing third party api logs:", error);
    }
}

module.exports = flushThirdPartyApiLogs