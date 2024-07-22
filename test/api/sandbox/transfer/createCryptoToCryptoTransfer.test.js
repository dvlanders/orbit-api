const supertest = require("supertest");
const app = require("@/app");
const { v4: uuidv4 } = require("uuid");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

describe("POST /transfer/crypto-to-crypto", function () {
  it("it should has status code 200", async () => {
    const accountRes = await supertest(app)
      .post(`/transfer/crypto-to-crypto?apiKeyId=${authTestParams.API_KEY}`)
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        senderUserId: userInfo.USER_ID,
        amount: 0.01,
        requestId: uuidv4(),
        currency: "usdc",
        chain: "POLYGON_AMOY",
        recipientAddress: "0x89dfD8792c7E7041c24F01223929F1d8Dd642F0c",
      });

    expect(statusChecker(accountRes, 200)).toBe(true);
    expect(accountRes.body.message).toBeDefined();
    expect(accountRes.body.message).toBe(
      "This endpoint is only available in production"
    );
  }, 10000);
});
