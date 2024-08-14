/* This is a JavaScript library that provides a consistent API for multiple different cryptographic
algorithms. */
const CryptoTS = require("crypto-ts");
const moment = require("moment");

exports.generateRandomNumberWithDigits = (digits) => {
	const min = Math.pow(10, digits - 1);
	const max = Math.pow(10, digits) - 1;
	const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
	return randomNumber.toString();
};

/* This is a function that takes a string and encrypts it using the `CryptoTS` library. */
exports.encryptText = (text) => {
	return CryptoTS.AES.encrypt(text, process.env.PASSWORD_SECRET_KEY).toString();
};

/* A function that takes a string and decrypts it using the `CryptoTS` library. */
exports.decryptText = (cipherText) => {
	const bytes = CryptoTS.AES.decrypt(
		cipherText,
		process.env.PASSWORD_SECRET_KEY
	);
	return bytes.toString(CryptoTS.enc.Utf8);
};

const { EventBridge } = require("@aws-sdk/client-eventbridge");
let eventBridge = new EventBridge({
	credentials: {
		accessKeyId: "AKIAWTCFUVBIDKIM73VF",
		secretAccessKey: "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",
	},
	region: "us-east-1",
});

exports.eventBridge = async (message, statusCode) => {
	try {
		const event = await eventBridge.putEvents({
			Entries: [
				{
					Source: "myapp.events",
					Detail: `{ \"message\": \"${message}\", \"statusCode\": \"${statusCode}\" }`,
					DetailType: "transaction",
					EventBusName: process.env.EVENT_BRIDGE_BUS_NAME,
				},
			],
		});
		return event?.FailedEntryCount == 0 ? true : false;
	} catch (error) {
		console.log(error.toString());
		return false;
	}
};

exports.getMonthName = (monthNumber) => {
	// Month in JavaScript is 0-indexed (0 for January, 1 for February, etc.),
	// so subtract 1 from the given month number
	let date = moment({ month: parseInt(monthNumber) - 1 });
	return date.format("MMM"); // 'MMM' gives the abbreviated month name
};
