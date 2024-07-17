const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("GET /transfer/fiat-to-crypto/all", function () {
  it("it should has status code 200", async () => {
    const txsRes = await supertest(app)
      .get(
        `/transfer/fiat-to-crypto/all?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(txsRes, 200)).toBe(true);
    const txs = txsRes.body;
    console.log(txs);
    expect(txs.count).toBeDefined();
    expect(txs.records).toBeDefined();
    if (txs.count > 0) {
      expect(txs.records[0].transferType).toBeDefined();
      expect(txs.records[0].transferType).toBe("FIAT_TO_CRYPTO");
      expect(txs.records[0].transferDetails).toBeDefined();
      console.log(txs.records[0].transferDetails);
    }
  }, 10000);
});
