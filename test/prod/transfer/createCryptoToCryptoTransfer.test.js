const supertest = require("supertest");
const app = require("../../../app");
const { v4: uuidv4 } = require("uuid");
const {
  authTestParams,
  userInfo,
  createCryptoToCryptoTransferParams,
} = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("POST /transfer/crypto-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/transfer/crypto-to-crypto?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        senderUserId: createCryptoToCryptoTransferParams.SENDER_USER_ID,
        amount: 0.0,
        requestId: uuidv4(),
        currency: "usdc",
        chain: "POLYGON_MAINNET",
        recipientUserId: createCryptoToCryptoTransferParams.RECIPIENT_USER_ID,
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    const account = accountRes.body;
    console.log(account);
    expect(account.transferType).toBeDefined();
    expect(account.transferType).toBe("CRYPTO_TO_CRYPTO");
    expect(account.transferDetails).toBeDefined();
  }, 10000);
});
