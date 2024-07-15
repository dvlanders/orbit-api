const supertest = require("supertest");
const app = require("../../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const RECORD_ID = process.env.FIAT_TO_CRYPTO_RECORD_ID_TEST;

describe("GET /transfer/fiat-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .get(`/transfer/fiat-to-crypto?apiKeyId=${API_KEY}&id=${RECORD_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    // const account = accountRes.body;
    // expect(account.transferType).toBeDefined();
    // expect(account.transferType).toBe("FIAT_TO_CRYPTO");
    // expect(account.transferDetails).toBeDefined();
  }, 10000);
});
