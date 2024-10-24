const { lokiPush } = require('./endpoint/ingestLogs');
const { safeParseBody } = require('../utils/response');

let logQueue = [];
const MAX_BATCH_SIZE = 100;

const enqueueLog = async (log, flushImmediately = false) => {

	logQueue.push(log);

	if (logQueue.length >= MAX_BATCH_SIZE || flushImmediately) {
	  await flushLogs();
	}

}
  
const flushLogs = async () => {

	if (logQueue.length === 0) return;

	const logBatch = [...logQueue];
	logQueue = [];

	const logEntries = {
		streams: [{
			stream: {
				app: `hifi-third-party-api-${process.env.NODE_ENV}`,
				source: 'grafana/grafanaLogger/logThirdPartyApi',
			},
			values: logBatch
		}]
	};

	try{
		await lokiPush(logEntries);
	}catch (error){
		console.error("Error flushing logs to Loki:", error);
		// Re-add the logs to the queue for retry
		logQueue = logBatch.concat(logQueue);
	}
}

const logHifiApi = async (message) => {

	try{
		const logEntry = {
			streams: [{
				stream: {
					app: `hifi-api-${process.env.NODE_ENV}`,
					source: 'grafana/grafanaLogger/logHifiApi',
					profileEmail: message.query.profileEmail,
					path: message.path,
				},
				values: [
					[`${Date.now() * 1e6}`, JSON.stringify(message, null, 2)]
				]
			}]
		};

		await lokiPush(logEntry);

	}catch (error){
		console.error("Error logging HiFi API call:", error);
	}

}

const logThirdPartyApi = async (thirdPartyUrl, tag, method, reqBody, response, error = null) => {

	try{
		const now = Date.now() * 1e6;

		const message = {
			url: thirdPartyUrl,
			tag: tag,
			method: method ? method : null,
			statusCode: response ? response.status : null,
			statusText: response ? response.statusText : null,
			requestBody: reqBody ? JSON.parse(reqBody) : null,
			responseBody: response ? await safeParseBody(response) : null,
			fetchError: error ? error.message : null
		}

		const logEntry = [`${now}`, JSON.stringify(message, null, 2)];
		const flushImmediately = (response && response.status >= 400) || error; // flush all logs right away if we have an error log entry
		await enqueueLog(logEntry, flushImmediately);

	}catch (error){
		console.error("Error logging third party API call:", error);
	}

}

module.exports = {
	logHifiApi,
	logThirdPartyApi,
	flushLogs
}
        