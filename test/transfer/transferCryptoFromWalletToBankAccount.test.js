const supertest = require("supertest");
const app = require("../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_TRANSFER_TEST;

describe("POST /transfer/crypto-to-fiat", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/transfer/crypto-to-fiat?apiKeyId=${API_KEY}&userId=${USER_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        requestId: "0ddde3de-ad5b-4ba1-885b-5ba985b7be68",
        sourceUserId: "e831771a-0fb5-4d5d-89db-07e5429a19df",
        destinationUserId: "e831771a-0fb5-4d5d-89db-07e5429a19df",
        destinationAccountId: "daa6ad75-a4c2-486f-a937-1bbf4d19553c",
        amount: 0.01,
        chain: "POLYGON_AMOY",
        sourceCurrency: "usdc",
        destinationCurrency: "usd",
        paymentRail: "ach",
      })
      .expect(200);

    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toBe(
      "This endpoint is only available in production"
    );
  }, 10000);
});
