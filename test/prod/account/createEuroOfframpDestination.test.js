const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, eurOfframpBankDetails } = require("../testConfig");
const { statusChecker } = require("../../testUtils");

// bridge needs additional kyc info to activate euro offramp with Sepa
describe("POST /account/euro/offramp", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/account/euro/offramp?apiKeyId=${authTestParams.API_KEY}&userId=${eurOfframpBankDetails.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        currency: "eur",
        bankName: eurOfframpBankDetails.BANK_NAME,
        accountOwnerName: eurOfframpBankDetails.ACCOUNT_OWNER_NAME,
        accountOwnerType: "individual",
        ibanAccountNumber: eurOfframpBankDetails.IBAN_ACCOUNT_NUMBER,
        ibanCountryCode: eurOfframpBankDetails.IBAN_COUNTRY_CODE,
        businessIdentifierCode: eurOfframpBankDetails.BIC,
        firstName: eurOfframpBankDetails.FIRST_NAME,
        lastName: eurOfframpBankDetails.LAST_NAME,
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    const account = accountRes.body;
    console.log(account);
    expect(account.status).toBeDefined();
    expect(account.status).toBe("ACTIVE");
    expect(account.message).toBeDefined();
    expect(account.id).toBeDefined();
  }, 30000);
});
