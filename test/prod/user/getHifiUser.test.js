const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");

describe("GET /user", function () {
  it("it should has status code 200", async () => {
    const userRes = await supertest(app)
      .get(
        `/user?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);

    const user = userRes.body;
    console.log(user);
    expect(user).toBeDefined();
    expect(user.user.id).toBeDefined();
    expect(user.user.id).toBe(userInfo.USER_ID);
    expect(user.wallet).toBeDefined();
    expect(user.wallet.walletStatus).toBe("ACTIVE");
    expect(user.wallet.walletAddress).toBeDefined();
    expect(user.user_kyc).toBeDefined();
    expect(user.ramps).toBeDefined();
  }, 30000);
});
