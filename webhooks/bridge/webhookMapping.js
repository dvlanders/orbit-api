const { processVirtualAccountEvent } = require("./processVirtualAccountEvent");

exports.webhookMapping = {
  "virtual_account.activity": processVirtualAccountEvent,
};
