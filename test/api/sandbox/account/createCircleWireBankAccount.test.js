const supertest = require("supertest");
const app = require("@/app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

describe("POST /account/wire/offramp", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/account/wire/offramp?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}&accountType=us`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
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
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    expect(accountRes.body.status).toBeDefined();
    expect(accountRes.body.status).toBe("pending");
  }, 30000);
});
