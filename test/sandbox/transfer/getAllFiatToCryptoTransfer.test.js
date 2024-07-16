const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");

describe("GET /transfer/fiat-to-crypto/all", function () {
  it("it should has status code 200", async () => {
    const accountsRes = await supertest(app)
      .get(
        `/transfer/fiat-to-crypto/all?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    const accounts = accountsRes.body;
    expect(accounts.count).toBeDefined();
    expect(accounts.records).toBeDefined();
  }, 10000);
});
