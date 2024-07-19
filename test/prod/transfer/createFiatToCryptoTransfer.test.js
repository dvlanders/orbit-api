const supertest = require("supertest");
const app = require("../../../app");
const { v4: uuidv4 } = require("uuid");
const {
  authTestParams,
  userInfo,
  createFiatToCryptoTransferParams,
} = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("POST /transfer/fiat-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/transfer/fiat-to-crypto?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
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
        destinationUserId: createFiatToCryptoTransferParams.DESTINATION_USER_ID,
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    const account = accountRes.body;
    console.log(account);
    expect(account.transferType).toBeDefined();
    expect(account.transferType).toBe("FIAT_TO_CRYPTO");
    expect(account.transferDetails).toBeDefined();
  }, 10000);
});
