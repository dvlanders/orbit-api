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

		if (!(key in acceptedFields)) {
			invalidFields.push(key);
			return; // Skip further checks if field is not accepted
		}

		const expectedType = acceptedFields[key];
		const actualType = Array.isArray(fields[key]) ? "array" : typeof fields[key];
		if (actualType !== expectedType) {
			console.log(`Invalid type for field: ${key}, expected: ${expectedType}, got: ${actualType}`);
			invalidFields.push(key);
		}
	});

	return { missingFields, invalidFields };
};

const isUUID = (uuid) => {
	const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return regex.test(uuid);
}

module.exports = {
	isUUID,
	fieldsValidation
}
