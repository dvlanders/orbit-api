const supertest = require("supertest");
const app = require("../../../app");
const {
  authTestParams,
  getFiatToCryptoTransferParams,
} = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("GET /transfer/fiat-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .get(
        `/transfer/fiat-to-crypto?apiKeyId=${authTestParams.API_KEY}&id=${getFiatToCryptoTransferParams.RECORD_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    // const account = accountRes.body;
    // expect(account.transferType).toBeDefined();
    // expect(account.transferType).toBe("FIAT_TO_CRYPTO");
    // expect(account.transferDetails).toBeDefined();
  }, 10000);
});
