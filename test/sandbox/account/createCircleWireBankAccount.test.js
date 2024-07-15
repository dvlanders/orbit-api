const supertest = require("supertest");
const app = require("../../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_ACCOUNT_TEST;

describe("POST /account/wire/offramp", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/account/wire/offramp?apiKeyId=${API_KEY}&userId=${USER_ID}&accountType=us`
      )
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        accountNumber: "1234567876",
        routingNumber: "121000248",
        accountHolderName: "Test Test",
        accountHolderCity: "New York",
        accountHolderCountry: "US",
        accountHolderStreetLine1: "123 Main St",
        accountHolderPostalCode: "10001",
        accountHolderStateProvinceRegion: "NY",
        bankCountry: "US",
      })
      .expect(200);

    expect(accountRes.body.status).toBeDefined();
    expect(accountRes.body.status).toBe("pending");
  }, 30000);
});
