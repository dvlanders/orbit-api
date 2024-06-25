const fieldsValidation = (fields, requiredFields, acceptedFields) => {
	const missingFields = [];
	const invalidFields = [];
	const fieldsKey = Object.keys(fields);

    // check if all required fields is provided
	requiredFields.map((key) => {
		if (fields[key] === undefined || fields[key] === "") {
			missingFields.push(key)
		}
	});

	fieldsKey.forEach((key) => {
		if (!acceptedFields.hasOwnProperty(key)) {
			invalidFields.push(key);
		} else {
			const expectedType = acceptedFields[key];
			const actualValue = fields[key];
			if (!isValidType(actualValue, expectedType)) {
				invalidFields.push(key);
			}
		}
	});

	return { missingFields, invalidFields };
}

const isValidType = (value, type) => {
	if (type === "array") {
		return Array.isArray(value);
	} else if (type === "object" && typeof value === "object") {
		return !Array.isArray(value) && value !== null;
	} else {
		return typeof value === type;
	}
}

module.exports = {
	fieldsValidation
}
