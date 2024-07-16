const supertest = require("supertest");
const app = require("../../../app");
const { v4: uuidv4 } = require("uuid");
const {
  authTestParams,
  userInfo,
  transferCryptoFromWalletToBankAccountParams,
} = require("../testConfig");

describe("POST /transfer/crypto-to-fiat", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(
        `/transfer/crypto-to-fiat?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
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
        amount: 1,
        chain: "POLYGON_MAINNET",
        sourceCurrency: "usdc",
        destinationCurrency: "usd",
        paymentRail: "ach",
      })
      .expect(200);

    const account = accountRes.body;
    console.log(account);
    expect(account.transferType).toBeDefined();
    expect(account.transferType).toBe("CRYPTO_TO_FIAT");
    expect(account.transferDetails).toBeDefined();
  }, 10000);
});
