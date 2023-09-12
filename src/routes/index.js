module.exports = (app, express) => {
    const router = express.Router();
    const registration = require("./registration");
    

    registration(router);

    app.use("/", router);
  };
  