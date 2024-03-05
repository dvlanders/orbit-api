const dynamoose = require("dynamoose");

const apiKeySchema = new dynamoose.Schema({
	id: {
		type: String,
		hashKey: true,
	},
	user_id: {
		type: String,
		required: true,
	},
	name: String,
	description: String,
	enabled: Boolean,
	environment: {
		type: String,
		enum: ["development", "staging", "production"],
	},
	apiKeyId: {
		type: String,
		required: true,
	},
	apiKeyValue: {
		type: String,
		required: true,
	},
}, {
	timestamps: {
		createdAt: "createDate",
		updatedAt: "updateDate",
	},
});

const apiKeyModel = dynamoose.model("apiKey", apiKeySchema);

module.exports = apiKeyModel;
