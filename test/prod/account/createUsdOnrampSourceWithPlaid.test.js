const supertest = require("supertest");
const app = require("../../../app");
const {
  authTestParams,
  userInfo,
  usdOnrampPlaidBankDetails,
} = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("POST /account/usd/onramp/plaid", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/account/usd/onramp/plaid?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        plaidProcessorToken: usdOnrampPlaidBankDetails.PLAID_TOKEN,
        accountType: usdOnrampPlaidBankDetails.ACCOUNT_TYPE,
        bankName: usdOnrampPlaidBankDetails.BANK_NAME,
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
