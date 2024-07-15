const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");

describe("GET /account/all", function () {
  it("it should has status code 200", async () => {
    await supertest(app)
      .get(
        `/account/all?apiKeyId=${authTestParams.API_KEY}&railType=usOnRamp&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    await supertest(app)
      .get(
        `/account/all?apiKeyId=${authTestParams.API_KEY}&railType=usOffRamp&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);
  }, 10000);
});
