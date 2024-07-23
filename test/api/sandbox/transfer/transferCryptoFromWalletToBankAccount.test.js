const supertest = require("supertest");
const app = require("@/app");
const { v4: uuidv4 } = require("uuid");
const {
  authTestParams,
  transferCryptoFromWalletToBankAccountParams,
} = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

describe("POST /transfer/crypto-to-fiat", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/transfer/crypto-to-fiat?apiKeyId=${authTestParams.API_KEY}`)
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        requestId: uuidv4(),
        sourceUserId:
          transferCryptoFromWalletToBankAccountParams.SOURCE_USER_ID,
        destinationUserId:
          transferCryptoFromWalletToBankAccountParams.DESTINATION_USER_ID,
        destinationAccountId:
          transferCryptoFromWalletToBankAccountParams.DESTINATION_ACCOUNT_ID,
        amount: 0.01,
        chain: "POLYGON_AMOY",
        sourceCurrency: "usdc",
        destinationCurrency: "usd",
        paymentRail: "ach",
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toBe(
      "This endpoint is only available in production"
    );
  }, 10000);
});
