const supertest = require("supertest");
const app = require("../../../app");
const {
  authTestParams,
  userInfo,
  usdOnrampPlaidBankDetails,
} = require("../testConfig");

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
      })
      .expect(200);

    expect(accountRes.body.status).toBeDefined();
    expect(accountRes.body.status).toBe("ACTIVE");
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.id).toBeDefined();
  }, 10000);
});
