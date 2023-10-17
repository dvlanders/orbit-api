const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const dotenv = require("dotenv");
let env =
  process.env.NODE_ENV === "production"
    ? "production"
    : process.env.NODE_ENV === "staging"
    ? "staging"
    : process.env.NODE_ENV === undefined
    ? "development"
    : "false";
let filePath = "./src/config/" + env + ".env";
let result = dotenv.config({ path: filePath, debug: true });
if (result.error) {
  console.log(result.error);
  process.exit(0);
}

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

// Middleware example that logs the current date for every request
// app.use((req, res, next) => {
//   console.log(res.json);
//   console.log(`Request received at: ${new Date().toISOString()}`);
//   next();
// });

// app.use((req, res, next) => {
//   const originalResJson = res.json;

//   res.json = function (data) {
//     console.log(`Response data: ${JSON.stringify(data)}`);
//     originalResJson.call(this, data);
//   };

//   next();
// });

require("./src/routes")(app, express);

let { logger } = require("./src/util/logger/logger");

app.listen(port, () => {
  // logger.info(`Server Listening On Port ${port}`);
  console.log(`Environment : ${env}`);
});

// Export your Express configuration so that it can be consumed by the Lambda handler
module.exports = app;
