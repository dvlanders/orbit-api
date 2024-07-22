const supertest = require("supertest");
const app = require("@/app");
const { authTestParams, getAccountParams } = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

describe("GET /account", function () {
  it("it should has status code 200", async () => {
    // testing getting onramp account
    const onrampAccountRes = await supertest(app)
      .get(
        `/account?apiKeyId=${authTestParams.API_KEY}&accountId=${getAccountParams.US_ONRAMP_ACCOUNT_ID}&railType=usOnRamp&userId=${getAccountParams.US_ONRAMP_USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(onrampAccountRes, 200)).toBe(true);

    // testing getting offramp account
    const offrampAccountRes = await supertest(app)
      .get(
        `/account?apiKeyId=${authTestParams.API_KEY}&accountId=${getAccountParams.US_OFFRAMP_ACCOUNT_ID}&railType=usOffRamp&userId=${getAccountParams.US_OFFRAMP_USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(offrampAccountRes, 200)).toBe(true);
  }, 10000);
});
