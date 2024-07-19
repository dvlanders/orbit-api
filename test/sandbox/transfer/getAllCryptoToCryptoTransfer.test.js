const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("GET /transfer/crypto-to-crypto/all", function () {
  it("it should has status code 200", async () => {
    const accountsRes = await supertest(app)
      .get(
        `/transfer/crypto-to-crypto/all?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(accountsRes, 200)).toBe(true);
    const accounts = accountsRes.body;
    expect(accounts.count).toBeDefined();
    expect(accounts.records).toBeDefined();
  }, 10000);
});
