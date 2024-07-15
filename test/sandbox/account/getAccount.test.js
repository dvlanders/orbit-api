const supertest = require("supertest");
const app = require("../../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const US_ONRAMP_ACCOUNT_ID = process.env.US_ONRAMP_AID_TEST;
const US_ONRAMP_USER_ID = process.env.US_ONRAMP_UID_TEST;
const US_OFFRAMP_ACCOUNT_ID = process.env.US_OFFRAMP_AID_TEST;
const US_OFFRAMP_USER_ID = process.env.US_OFFRAMP_UID_TEST;

describe("GET /account", function () {
  it("it should has status code 200", async () => {
    // testing getting onramp account
    const onrampAccountRes = await supertest(app)
      .get(
        `/account?apiKeyId=${API_KEY}&accountId=${US_ONRAMP_ACCOUNT_ID}&railType=usOnRamp&userId=${US_ONRAMP_USER_ID}`
      )
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    // testing getting offramp account
    const offrampAccountRes = await supertest(app)
      .get(
        `/account?apiKeyId=${API_KEY}&accountId=${US_OFFRAMP_ACCOUNT_ID}&railType=usOffRamp&userId=${US_OFFRAMP_USER_ID}`
      )
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);
  }, 10000);
});
