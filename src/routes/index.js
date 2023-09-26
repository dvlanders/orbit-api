

module.exports = (app, express) => {
    const router = express.Router();
    const registration = require("./registration");
    const user = require("./user")
    const payment = require("./payment")

    

    registration(router);
    user(router);
    payment(router);

    app.use("/", router);
  };
  