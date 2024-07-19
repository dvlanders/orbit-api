const supertest = require("supertest");
const app = require("../../../app");
const {
  authTestParams,
  getCryptoToFiatTransferParams,
} = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("GET /transfer/crypto-to-fiat", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .get(
        `/transfer/crypto-to-fiat?apiKeyId=${authTestParams.API_KEY}&id=${getCryptoToFiatTransferParams.RECORD_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    // const account = accountRes.body;
    // console.log(account);
    // expect(account.transferType).toBeDefined();
    // expect(account.transferType).toBe("CRYPTO_TO_FIAT");
    // expect(account.transferDetails).toBeDefined();
  }, 10000);
});
