const supertest = require("supertest");
const app = require("../../../app");
const { v4: uuidv4 } = require("uuid");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_TRANSFER_TEST;
const ACCOUNT_ID = process.env.CHECKBOOK_PLAID_AID_TEST;

describe("POST /transfer/fiat-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/transfer/fiat-to-crypto?apiKeyId=${API_KEY}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        requestId: uuidv4(),
        sourceUserId: USER_ID,
        sourceAccountId: ACCOUNT_ID,
        amount: 1,
        chain: "POLYGON_MAINNET",
        sourceCurrency: "usd",
        destinationCurrency: "usdc",
        isInstant: false,
        destinationUserId: "75d7c01f-5f93-4490-8b93-a62fd8020358",
      })
      .expect(200);

    const account = accountRes.body;
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toBe(
      "This endpoint is only available in production"
    );
  }, 10000);
});
