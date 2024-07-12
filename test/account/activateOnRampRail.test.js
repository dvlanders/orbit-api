const supertest = require("supertest");
const app = require("../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_ACCOUNT_TEST;

// This will not work in sandbox because testnets in destinationChain is not supported
describe("POST /account/activateOnRampRail", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/account/activateOnRampRail?apiKeyId=${API_KEY}&userId=${USER_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        rail: "US_ACH",
        destinationCurrency: "usdc",
        destinationChain: "POLYGON_AMOY",
      })
      .expect(200);
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toMatch(/(successfully|activated)$/);
  }, 20000);
});
