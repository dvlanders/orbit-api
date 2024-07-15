const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, usdOfframpBankDetails } = require("../testConfig");

describe("POST /account/usd/offramp", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/account/usd/offramp?apiKeyId=${authTestParams.API_KEY}&userId=${usdOfframpBankDetails.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        currency: "usd",
        bankName: "Chase",
        accountOwnerName: "Test Test",
        accountNumber: "1234567876",
        routingNumber: "000000017",
        streetLine1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        accountOwnerType: "individual",
      })
      .expect(200);

    expect(accountRes.body.status).toBeDefined();
    expect(accountRes.body.status).toBe("ACTIVE");
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.id).toBeDefined();
  }, 10000);
});
