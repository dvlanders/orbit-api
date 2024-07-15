const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");

describe("POST /account/euro/offramp", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/account/euro/offramp?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
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

    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toBe(
      "Account would normally be successfully created. However, euro offramp creation is currently not available in sandbox."
    );
  }, 10000);
});
