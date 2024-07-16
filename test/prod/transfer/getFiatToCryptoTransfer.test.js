const supertest = require("supertest");
const app = require("../../../app");
const {
  authTestParams,
  getFiatToCryptoTransferParams,
} = require("../testConfig");

describe("GET /transfer/fiat-to-crypto", function () {
  it("it should has status code 200", async () => {
    const txRes = await supertest(app)
      .get(
        `/transfer/fiat-to-crypto?apiKeyId=${authTestParams.API_KEY}&id=${getFiatToCryptoTransferParams.RECORD_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    const tx = txRes.body;
    console.log(tx);
    expect(tx.transferType).toBeDefined();
    expect(tx.transferType).toBe("FIAT_TO_CRYPTO");
    expect(tx.transferDetails).toBeDefined();
    expect(tx.transferDetails.id).toBeDefined();
    expect(tx.transferDetails.id).toBe(getFiatToCryptoTransferParams.RECORD_ID);
  }, 10000);
});
