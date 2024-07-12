const supertest = require("supertest");
const app = require("../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_ACCOUNT_TEST;

describe("POST /account/euro/offramp", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/account/euro/offramp?apiKeyId=${API_KEY}&userId=${USER_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        currency: "eur",
        bankName: "Deutsche Bank",
        accountOwnerName: "Test Test",
        accountOwnerType: "individual",
        ibanAccountNumber: "DE89370400440532013000",
        ibanCountryCode: "DEU",
        businessIdentifierCode: "DEUTDEDBFRA",
        firstName: "Test",
        lastName: "Test",
      })
      .expect(400);

    expect(accountRes.body.message).toBe(
      "Account would normally be successfully created. However, euro offramp creation is currently not available in sandbox."
    );
  }, 10000);
});
