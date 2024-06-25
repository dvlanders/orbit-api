const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// const env = process.env.NODE_ENV ?? "production";
const env = 'development';

const result = require("dotenv").config({ path: `.env.${env}`, debug: env === "production" });

if (result.error) {
	console.log(result.error);
	process.exit(0);
}

// Swagger definition
const swaggerDefinition = {
	openapi: '3.0.0',
	info: {
		title: 'Hifi API',
		version: '1.0.0',
		description: 'API documentation for Hifi',
	},
	servers: [
		{
			url: 'https://api.hifibridge.com',
			description: 'Production server',
		},
		{
			url: 'https://sandbox.hifibridge.com',
			description: 'Sandbox server',
		},
	],
};

// Options for the swagger docs
const options = {
	swaggerDefinition,
	apis: ['./src/routes/*.js'], // Adjust the path according to your project structure
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

let port = process.env.PORT || 5000;

/* This is a middleware function that allows the server to accept the data that is being sent to it. */
const cors = require("cors");
app.use(cors());

/* This is a middleware function that allows the server to accept the data that is being sent to it. */
app.use(express.json());

/* This is a middleware function that allows the server to accept the data that is being sent to it. */
app.use(express.urlencoded({ extended: false }));

const { common } = require("./src/util/helper");

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Import your routes
require("./src/routes")(app, express);

let { logger } = require("./src/util/logger/logger");

require('./cron');

app.listen(port, () => {
	logger.info(`Server Listening On Port ${port}`);
	console.log(`Environment : ${env}`);
});

// Export your Express configuration so that it can be consumed by the Lambda handler
module.exports = app;
