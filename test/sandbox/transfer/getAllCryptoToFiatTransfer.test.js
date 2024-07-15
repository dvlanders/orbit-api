const supertest = require("supertest");
const app = require("../../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_TRANSFER_TEST;

describe("GET /transfer/crypto-to-fiat/all", function () {
  it("it should has status code 200", async () => {
    const accountsRes = await supertest(app)
      .get(`/transfer/crypto-to-fiat/all?apiKeyId=${API_KEY}&userId=${USER_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    const accounts = accountsRes.body;
    expect(accounts.count).toBeDefined();
    expect(accounts.records).toBeDefined();
  }, 10000);
});
