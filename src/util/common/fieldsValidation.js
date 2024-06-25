const fieldsValidation = (fields, requiredFields, acceptedFields) => {
	const missingFields = []
	const invalidFields = []
	const fieldsKey = Object.keys(fields)

	// check if all required fields is provided
	requiredFields.map((key) => {
		if (fields[key] === undefined || fields[key] === "") {
			missingFields.push(key)
		}
	})

	// check if all fields are valid
	fieldsKey.map((key) => {
		if (!(key in acceptedFields) || typeof (fields[key]) != acceptedFields[key]) {
			invalidFields.push(key)
		}
	})

	return { missingFields, invalidFields }
}

const isUUID = (uuid) => {
	const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return regex.test(uuid);
}

module.exports = {
	isUUID,
	fieldsValidation
}