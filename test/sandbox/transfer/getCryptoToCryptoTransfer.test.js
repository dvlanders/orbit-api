const supertest = require("supertest");
const app = require("../../../app");
const {
  authTestParams,
  getCryptoToCryptoTransferParams,
} = require("../testConfig");

describe("GET /transfer/crypto-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .get(
        `/transfer/crypto-to-crypto?apiKeyId=${authTestParams.API_KEY}&id=${getCryptoToCryptoTransferParams.RECORD_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    // const account = accountRes.body;
    // expect(account.transferType).toBeDefined();
    // expect(account.transferType).toBe("CRYPTO_TO_CRYPTO");
    // expect(account.transferDetails).toBeDefined();
  }, 10000);
});
