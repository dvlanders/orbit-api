const supertest = require("supertest");
const app = require("../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_ACCOUNT_TEST;

describe("GET /account/all", function () {
  it("it should has status code 200", async () => {
    await supertest(app)
      .get(
        `/account/all?apiKeyId=${API_KEY}&railType=usOnRamp&userId=${USER_ID}`
      )
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    await supertest(app)
      .get(
        `/account/all?apiKeyId=${API_KEY}&railType=usOffRamp&userId=${USER_ID}`
      )
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);
  }, 10000);
});
