const supertest = require("supertest");
const app = require("../../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const PLAID_TOKEN = process.env.PLAID_PROCESSOR_TOKEN_TEST;
const USER_ID = process.env.UID_ACCOUNT_TEST;

describe("POST /account/usd/onramp/plaid", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/account/usd/onramp/plaid?apiKeyId=${API_KEY}&userId=${USER_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        plaidProcessorToken: PLAID_TOKEN,
        accountType: "SAVINGS",
        bankName: "Bank of America",
      })
      .expect(200);

    expect(accountRes.body.status).toBeDefined();
    expect(accountRes.body.status).toBe("ACTIVE");
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.id).toBeDefined();
  }, 10000);
});
