const { processVirtualAccountEvent } = require("./processVirtualAccountEvent");
const { processCustomerEvent } = require("./processCustomerEvent");
const { processKycLinkEvent } = require("./processKycLinkEvent");
const { processLiquidationAddressDrainEvent } = require("./processLiquidationAddressDrainEvent");
const { processStaticMemoActivityEvent } = require("./processStaticMemoActivityEvent");
const { processTransferEvent } = require("./processTransferEvent");

const webhookMapping = {
  "virtual_account.activity": processVirtualAccountEvent,
  "customer": processCustomerEvent,
  "kyc_link": processKycLinkEvent,
  "liquidation_address.drain": processLiquidationAddressDrainEvent,
  "static_memo.activity": processStaticMemoActivityEvent,
  "transfer": processTransferEvent,
};

const getWebhookProcessor = (eventCategory) => {
  const processor = webhookMapping[eventCategory];
  if (!processor) {
    throw new Error(`No event processor found for event category ${eventCategory}`);
  }
  return processor;
}

module.exports = { getWebhookProcessor };