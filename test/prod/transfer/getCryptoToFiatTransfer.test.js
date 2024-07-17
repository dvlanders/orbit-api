const supertest = require("supertest");
const app = require("../../../app");
const {
  authTestParams,
  getCryptoToFiatTransferParams,
} = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("GET /transfer/crypto-to-fiat", function () {
  it("it should has status code 200", async () => {
    const txRes = await supertest(app)
      .get(
        `/transfer/crypto-to-fiat?apiKeyId=${authTestParams.API_KEY}&id=${getCryptoToFiatTransferParams.RECORD_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(txRes, 200)).toBe(true);
    const tx = txRes.body;
    console.log(tx);
    expect(tx.transferType).toBeDefined();
    expect(tx.transferType).toBe("CRYPTO_TO_FIAT");
    expect(tx.transferDetails).toBeDefined();
    expect(tx.transferDetails.id).toBeDefined();
    expect(tx.transferDetails.id).toBe(getCryptoToFiatTransferParams.RECORD_ID);
  }, 10000);
});
