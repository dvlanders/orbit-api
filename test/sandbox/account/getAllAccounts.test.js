const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("GET /account/all", function () {
  it("it should has status code 200", async () => {
    const onrampAccountsRes = await supertest(app)
      .get(
        `/account/all?apiKeyId=${authTestParams.API_KEY}&railType=usOnRamp&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(onrampAccountsRes, 200)).toBe(true);

    const offrampAccountsRes = await supertest(app)
      .get(
        `/account/all?apiKeyId=${authTestParams.API_KEY}&railType=usOffRamp&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(offrampAccountsRes, 200)).toBe(true);
  }, 10000);
});
