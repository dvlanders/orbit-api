module.exports = (app, express) => {
  const router = express.Router();
  const registration = require("./registration");
  const user = require("./user");
  const payment = require("./payment");
  const accountManagement = require("./accountManagement");
  const payout = require("./payout");
  const refund = require("./refund");
  const walletConnect = require("./walletConnect");
  const upload = require("./upload");
  const customer = require("./customer");

  registration(router);
  user(router);
  payment(router);
  payout(router);
  accountManagement(router);
  refund(router);
  walletConnect(router);
  upload(router);
  customer(router);
  app.use("/", router);
};
