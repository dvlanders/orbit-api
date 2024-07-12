const supertest = require("supertest");
const app = require("../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_TRANSFER_TEST;

describe("POST /transfer/fiat-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/transfer/fiat-to-crypto?apiKeyId=${API_KEY}&userId=${USER_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        requestId: "0ddde3de-ad5b-4ba1-885b-5ba985b7be68",
        sourceUserId: "e831771a-0fb5-4d5d-89db-07e5429a19df",
        sourceAccountId: "0de2ae79-737d-4266-8c7d-ec82df476d3a",
        amount: 1,
        chain: "POLYGON_MAINNET",
        sourceCurrency: "usd",
        destinationCurrency: "usdc",
        isInstant: false,
        destinationUserId: "75d7c01f-5f93-4490-8b93-a62fd8020358",
      })
      .expect(200);

    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toBe(
      "This endpoint is only available in production"
    );
  }, 10000);
});
