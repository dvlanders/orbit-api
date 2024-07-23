const { format, createLogger, transports } = require("winston");
const LokiTransport = require('winston-loki');
const { combine, timestamp, label, prettyPrint } = format;
require("winston-daily-rotate-file");
const CATEGORY = "Log Rotation";
const path = require("path");

const fileRotateTransport = new transports.DailyRotateFile({
	filename: path.join(
		__dirname,
		`/../logs/${process.env.NODE_ENV === undefined ? "development" : process.env.NODE_ENV
		}/%DATE%.txt`
	),
	datePattern: "YYYY-MM-DD",
	// maxFiles: "14d",
});

const logger = createLogger({
	level: "debug",
	format: combine(
		label({ label: CATEGORY }),
		timestamp({ format: "MMM-DD-YYYY HH:mm:ss" }),
		prettyPrint()
	),
	transports: [fileRotateTransport]
});

const lokiTransport = new LokiTransport({
	host: 'https://logs-prod-006.grafana.net',
	basicAuth: '947672:glc_eyJvIjoiMTE3ODg0OCIsIm4iOiJzdGFjay05ODk4OTItaGwtcmVhZC1kZWZhdWx0dG9rZW4iLCJrIjoiSDc4SUxOMjI1cnlZZjU2cFRJcndUNDg3IiwibSI6eyJyIjoicHJvZC11cy1lYXN0LTAifX0=',
	json: true,
	labels: { job: 'hifi-api' }
});

logger.add(lokiTransport);

logger.add(new transports.Console({ format: format.simple() }));



module.exports = {
	logger,
};
