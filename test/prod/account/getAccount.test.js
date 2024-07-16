const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, getAccountParams } = require("../testConfig");

describe("GET /account", function () {
  it("it should has status code 200", async () => {
    // testing getting onramp account
    const usOnrampAccountRes = await supertest(app)
      .get(
        `/account?apiKeyId=${authTestParams.API_KEY}&accountId=${getAccountParams.US_ONRAMP_ACCOUNT_ID}&railType=usOnRamp&userId=${getAccountParams.US_ONRAMP_USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);
    console.log(usOnrampAccountRes.body);
    // testing getting onramp account
    const euOffRampAccountRes = await supertest(app)
      .get(
        `/account?apiKeyId=${authTestParams.API_KEY}&accountId=${getAccountParams.EU_OFFRAMP_ACCOUNT_ID}&railType=euOffRamp&userId=${getAccountParams.EU_OFFRAMP_USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);
    console.log(euOffRampAccountRes.body);
    // testing getting offramp account
    const usOfframpAccountRes = await supertest(app)
      .get(
        `/account?apiKeyId=${authTestParams.API_KEY}&accountId=${getAccountParams.US_OFFRAMP_ACCOUNT_ID}&railType=usOffRamp&userId=${getAccountParams.US_OFFRAMP_USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);
    console.log(usOfframpAccountRes.body);
  }, 10000);
});
