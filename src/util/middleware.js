// JSON Web Token, is an open standard used to share security information between two parties — a client and a server.
const jwt = require("jsonwebtoken");

/* Loading the environment variables from the `.env` file. */
require("dotenv").config();

/* A middleware function that will be called before any other route handler. */
exports.authorizeUser = (req, res, next) => {
  let token = req.headers.authorization;
  if (token === null) {
    return res.sendStatus(403);
  } else {
    try {
      req.user = jwt.verify(token, process.env.APP_TOKEN_KEY);
      next();
    } catch (err) {
      return res.send({
        message: err.toString(),
      });
    }
  }
};
