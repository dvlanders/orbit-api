
const { internalBilling } = require("../../controllers");

module.exports = (router) => {
    router.post("/internal/billing", internalBilling.addBilling);
};


