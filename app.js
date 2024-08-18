const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const swaggerDocument = require('./src/swagger/swaggerDocument');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

// use this to get NODE_ENV
const localEnv = require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH });
if (localEnv.error) {
	console.log(localEnv.error);
	process.exit(0);
}
console.log("ENV:", process.env.NODE_ENV)
const env = process.env.NODE_ENV ?? "production";
// const env = 'development';
const result = require("dotenv").config({ path: `.env.${env}`, debug: env === "production" });

if (result.error) {
	console.log(result.error);
	process.exit(0);
}

// for bridge webhook
app.use('/webhook/bridge', express.raw({ type: 'application/json' }));

// for stripe webhook
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));

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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/openapi.json', express.static(path.join(__dirname, 'src/swagger/openapi.json')));

// Import your routes
require("./src/routes")(app, express);

let { logger } = require("./src/util/logger/logger");

require('./cron');
require('./listeners/supabaseListener');

if(!process.env.NODE_TEST){
	app.listen(port, () => {
		logger.info(`Server Listening On Port ${port}`);
		console.log(`Environment : ${env}`);
	});
}

// Export your Express configuration so that it can be consumed by the Lambda handler
module.exports = app;
