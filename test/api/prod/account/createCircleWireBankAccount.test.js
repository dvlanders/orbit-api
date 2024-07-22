const supertest = require("supertest");
const app = require("@/app");
const {
  authTestParams,
  userInfo,
  usdOfframpCircleWireBankDetails,
} = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

// TODO: need circle prod api key
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
        accountNumber: usdOfframpCircleWireBankDetails.ACCOUNT_NUMBER,
        routingNumber: usdOfframpCircleWireBankDetails.ROUTING_NUMBER,
        accountHolderName: usdOfframpCircleWireBankDetails.ACCOUNT_HOLDER_NAME,
        accountHolderCity: usdOfframpCircleWireBankDetails.ACCOUNT_HOLDER_CITY,
        accountHolderCountry:
          usdOfframpCircleWireBankDetails.ACCOUNT_HOLDER_COUNTRY,
        accountHolderStreetLine1:
          usdOfframpCircleWireBankDetails.ACCOUNT_HOLDER_STREET_LINE1,
        accountHolderPostalCode:
          usdOfframpCircleWireBankDetails.ACCOUNT_HOLDER_POSTAL_CODE,
        accountHolderStateProvinceRegion:
          usdOfframpCircleWireBankDetails.ACCOUNT_HOLDER_STATE_PROVINCE_REGION,
        bankCountry: usdOfframpCircleWireBankDetails.BANK_COUNTRY,
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    const account = accountRes.body;
    console.log(account);
    expect(account.status).toBeDefined();
    expect(account.status).toBe("pending");
  }, 30000);
});
