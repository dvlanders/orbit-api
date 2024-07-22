const supertest = require("supertest");
const app = require("@/app");
const {
  authTestParams,
  userInfo,
  usdOnrampPlaidBankDetails,
} = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

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
        accountType: "SAVINGS",
        bankName: "Bank of America",
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    expect(accountRes.body.status).toBeDefined();
    expect(accountRes.body.status).toBe("ACTIVE");
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.id).toBeDefined();
  }, 10000);
});
