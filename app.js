const express = require("express");
const bodyParser = require("body-parser")

/* This is creating an instance of the Express framework. */
const app = express();
/* This is a function that is used to upload files to the server. */

// require("./src/models")
/* This is a function that is used to set environment variables. */
const dotenv = require("dotenv");

/* Setting the environment variable `NODE_ENV` to the value of `production`, `preproduction`,
`development`, or `false`. */
let env =
  process.env.NODE_ENV === "production"
    ? "production"
    : process.env.NODE_ENV === "preproduction"
    ? "preproduction"
    : process.env.NODE_ENV === undefined
    ? "development"
    : "false";
let filePath = "./src/config/" + env + ".env";
let result = dotenv.config({ path: filePath });
if (result.error) {
  console.log(result.error);
  process.exit(0);
}

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

/* This is a way to set a default port value. If the environment variable `PORT` is not set, then the
default value of `5000` will be used. */
let port = process.env.PORT || 5000;

/* This is a middleware function that allows the server to accept the data that is being sent to it. */
const cors = require("cors");
app.use(cors());



/* This is a middleware function that allows the server to accept the data that is being sent to it. */
app.use(express.json());

/* This is a middleware function that allows the server to accept the data that is being sent to it. */
app.use(express.urlencoded({ extended: false }));

/* This is a function that is called in the `app.listen` function. It is a function that is defined in
the `routers.js` file. */
require("./src/routes")(app, express);

/* A callback function that will be executed when the server is listening on the port. */
app.listen(port, () => {
  console.log(`Environment : ${env}`);
  console.log(`Listening on PORT ${port}`);
});
