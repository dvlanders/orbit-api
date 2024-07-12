const supertest = require("supertest");
const app = require("../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_TRANSFER_TEST;

describe("POST /transfer/crypto-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/transfer/crypto-to-crypto?apiKeyId=${API_KEY}&userId=${USER_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        senderUserId: USER_ID,
        amount: 0.01,
        requestId: "ae8a73d3-0680-45e2-a815-7f042f49081e",
        currency: "usdc",
        chain: "POLYGON_AMOY",
        recipientAddress: "0x89dfD8792c7E7041c24F01223929F1d8Dd642F0c",
      })
      .expect(200);

    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toBe(
      "This endpoint is only available in production"
    );
  }, 10000);
});
