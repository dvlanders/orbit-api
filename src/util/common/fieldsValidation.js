const fieldsValidation = (fields, requiredFields, acceptedFields) => {
	const missingFields = [];
	const invalidFields = [];
	const fieldsKey = Object.keys(fields);

	// Check if all required fields are provided
	requiredFields.forEach((key) => {
		if (fields[key] === undefined || fields[key] === "") {
			missingFields.push(key);
		}
	});

	// Check if all fields are valid
	fieldsKey.forEach((key) => {
		if (key == "apiKeyId") return
		if (key == "profileId") return
		if (key == "prod_enabled") return
		if (key == "originProfileId") return
		if (key == "profileEmail") return

		if (!(key in acceptedFields)) {
			invalidFields.push(key);
			return; // Skip further checks if field is not accepted
		}

		const expectedType = acceptedFields[key];
		const actualType = Array.isArray(fields[key]) ? "array" : typeof fields[key];
		if (typeof expectedType == "function") {
			if (!expectedType(fields[key])) {
				invalidFields.push(key);
			}

		}else if (Array.isArray(expectedType) && !expectedType.includes(actualType)) {
			console.log(`Invalid type for field: ${key}, expected: ${expectedType}, got: ${actualType}`);
			invalidFields.push(key);

		}else if (typeof expectedType == "string" && actualType !== expectedType) {
			console.log(`Invalid type for field: ${key}, expected: ${expectedType}, got: ${actualType}`);
			invalidFields.push(key);
			console.log('invalid fields', key, invalidFields)
		}
	});
	return { missingFields, invalidFields };
};

const isUUID = (uuid) => {
	const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return regex.test(uuid);
}

const isValidRoutingNumber = (routingNumber) => {
    return /^[0-9]{9}$/.test(routingNumber);
}

const isValidISODateFormat = (dateString) => {
	const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
	const date = new Date(dateString);
	return isoDateRegex.test(dateString) && !isNaN(date.getTime());
}


module.exports = {
	isUUID,
	isValidISODateFormat,
	fieldsValidation,
    isValidRoutingNumber
}
