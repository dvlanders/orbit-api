


module.exports = (app, express) => {
    const router = express.Router();
    const registration = require("./registration");
    const user = require("./user")
    const payment = require("./payment")
    const accountManagement = require("./accountManagement")
    const payout = require("./payout")

    

    registration(router);
    user(router);
    payment(router);
    payout(router);
    accountManagement(router)
    app.use("/", router);
  };
  