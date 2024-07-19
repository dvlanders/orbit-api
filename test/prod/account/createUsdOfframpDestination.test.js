const supertest = require("supertest");
const app = require("../../../app");
const {
  authTestParams,
  userInfo,
  usdOfframpBankDetails,
} = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("POST /account/usd/offramp", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/account/usd/offramp?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        currency: "usd",
        bankName: usdOfframpBankDetails.BANK_NAME,
        accountOwnerName: usdOfframpBankDetails.ACCOUNT_OWNER_NAME,
        accountNumber: usdOfframpBankDetails.ACCOUNT_NUMBER,
        routingNumber: usdOfframpBankDetails.ROUTING_NUMBER,
        streetLine1: usdOfframpBankDetails.STREET_LINE_1,
        city: usdOfframpBankDetails.CITY,
        state: usdOfframpBankDetails.STATE,
        postalCode: usdOfframpBankDetails.POSTAL_CODE,
        country: usdOfframpBankDetails.COUNTRY,
        accountOwnerType: "individual",
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    const account = accountRes.body;
    console.log(account);
    expect(accountRes.body.status).toBeDefined();
    expect(accountRes.body.status).toBe("ACTIVE");
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.id).toBeDefined();
  }, 30000);
});
