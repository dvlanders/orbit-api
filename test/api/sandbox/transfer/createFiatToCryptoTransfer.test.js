const supertest = require("supertest");
const app = require("@/app");
const { v4: uuidv4 } = require("uuid");
const {
  authTestParams,
  createFiatToCryptoTransferParams,
} = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

describe("POST /transfer/fiat-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/transfer/fiat-to-crypto?apiKeyId=${authTestParams.API_KEY}`)
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        requestId: uuidv4(),
        sourceUserId: createFiatToCryptoTransferParams.SOURCE_USER_ID,
        sourceAccountId: createFiatToCryptoTransferParams.SOURCE_ACCOUNT_ID,
        amount: 1,
        chain: "POLYGON_MAINNET",
        sourceCurrency: "usd",
        destinationCurrency: "usdc",
        isInstant: false,
        destinationUserId: "75d7c01f-5f93-4490-8b93-a62fd8020358",
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    const account = accountRes.body;
    expect(account.message).toBeDefined();
    expect(account.message).toBe(
      "This endpoint is only available in production"
    );
  }, 10000);
});
