const { checkIsSignedAgreementIdSigned } = require("../user/signedAgreement");
const { hifiSupportedChain } = require("./blockchain");

const isValidDate = (input, type = "YYYY-MM-DD") => {
	if (type === "ISO") {
		const date = new Date(input);
		return !isNaN(date.getTime());
	}

	// Check if the input is a string
	if (typeof input !== 'string') {
		return false;
	}

	// Regular expression to check if the format is YYYY-MM-DD
	const regex = /^\d{4}-\d{2}-\d{2}$/;

	if (!regex.test(input)) {
		return false;
	}

	// Parse the date components
	const [year, month, day] = input.split('-').map(Number);

	// Check if the date is valid
	const date = new Date(`${year}-${month}-${day}`);

	// Date object automatically rolls over invalid dates, so we need to verify the input matches
	return (
		date.getFullYear() === year &&
		date.getMonth() + 1 === month && // getMonth() returns 0-based month
		date.getDate() === day
	);
};

const isValidEmail = (input) => {
	// Check if the input is a string
	if (typeof input !== 'string') {
		return false;
	}

	// Regular expression to validate email format
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	return regex.test(input);
};

const isValidState = (stateCode) => {
	// Invalid state codes array
	const invalidStates = ["NY", "FL", "LA", "AK"];

	// Check if stateCode is a string
	if (typeof stateCode !== 'string') {
		return false;
	}

	// Ensure the state code is not in the invalid states array
	return !invalidStates.includes(stateCode);
};

const isValidCountryCode = (countryCode) => {
	// List of restricted country codes
	const restrictedCountries = ["CUB", "IRN", "SDN", "PRK", "VEN", "RUS", "UKR", "BLR", "MMR", "SYR"];

	// Check if countryCode is a string
	if (typeof countryCode !== 'string' || countryCode.length !== 3) {
		return false;
	}

	// Ensure the country code is not in the restricted countries array
	return !restrictedCountries.includes(countryCode);
};

const inStringEnum = (value, enumArray) => {
	return typeof value === 'string' && enumArray.includes(value);
}

const isValidUrl = (url) => {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
};

const isValidIPv4 = (ip) => {
	const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
	return ipv4Regex.test(ip);
};

const isInRange = (value, min, max) => {
	return value >= min && value <= max;
}

const isHIFISupportedChain = (chain) => {
	return hifiSupportedChain.includes(chain)
}

const isValidAmount = (amount, min = 0, max = Infinity) => {
	return (typeof amount === "number" && amount >= min && amount <= max) || (typeof amount === "string" && !isNaN(amount) && Number(amount) >= min && Number(amount) <= max)
}

const isValidMessage = (message, maxLines = Infinity, maxLengthPerLine = Infinity) => {
	const lines = message.split('\n');
	if (lines.length > maxLines) {
		return false;
	}

	for (const line of lines) {
		if (line.length > maxLengthPerLine) {
			return false;
		}
	}

	return true;
}

module.exports = {
	isValidDate,
	isValidEmail,
	isValidState,
	isValidCountryCode,
	inStringEnum,
	isValidUrl,
	isValidIPv4,
	isInRange,
	isHIFISupportedChain,
	isValidAmount,
	isValidMessage
}
