const { format, createLogger, transports } = require("winston");
const { combine, timestamp, label, printf, prettyPrint, json } = format;
require("winston-daily-rotate-file");
const CATEGORY = "Log Rotation";
const path = require("path");

const fileRotateTransport = new transports.DailyRotateFile({
  filename: path.join(
    __dirname +
      `/../logs/${
        process.env.NODE_ENV == undefined ? "development" : process.env.NODE_ENV
      }/` +
      "%DATE%.txt"
  ),
  datePattern: "YYYY-MM-DD",
  // maxFiles: "14d",
});

const logger = createLogger({
  level: "debug",
  format: combine(
    label({
      label: CATEGORY,
    }),
    timestamp({
      format: "MMM-DD-YYYY HH:mm:ss",
    }),
    prettyPrint()
  ),
  transports: [fileRotateTransport, new transports.Console()],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.simple(),
    })
  );
}

module.exports = {
  logger,
};
