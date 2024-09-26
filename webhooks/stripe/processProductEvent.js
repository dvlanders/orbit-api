const createLog = require("../../src/util/logger/supabaseLogger");
const { insertProduct, deleteProduct } = require("../../src/util/stripe/stripeService");

const processProductEvent = async (event) => {
  try {
    if (event.type === "product.created") {
      const object = event.data?.object;
      const productId = object?.id;
      const name = object?.name;
      const product = await insertProduct(productId, name);
    } else if (event.type === "product.deleted") {
      const productId = event.data?.object?.id;
      await deleteProduct(productId);
    }
  } catch (error) {
    await createLog(
      "webhooks/stripe/processProductEvent",
      null,
      `Failed to process product event`,
      error
    );
    throw error;
  }
};

module.exports = {
  processProductEvent,
};
