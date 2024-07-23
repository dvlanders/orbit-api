const supertest = require("supertest");
const app = require("@/app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

describe("POST /account/activateOnRampRail", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/account/activateOnRampRail?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        rail: "US_ACH",
        destinationCurrency: "usdc",
        destinationChain: "POLYGON_AMOY",
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toMatch(/(successfully|activated)$/);
  }, 20000);
});
