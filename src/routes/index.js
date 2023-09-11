module.exports = (app, express) => {
    const router = express.Router();
    const user = require("./user");

    user(router);

    app.use("/", router);
  };
  