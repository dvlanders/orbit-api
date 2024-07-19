const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("PUT /user", function () {
  it("it should has status code 200", async () => {
    const userRes = await supertest(app)
      .put(
        `/user?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        legalFirstName: "Hsin-Hung",
      });

    expect(statusChecker(userRes, 200)).toBe(true);
    const user = userRes.body;
    expect(user).toBeDefined();
    expect(user.user.id).toBeDefined();
    expect(user.user.id).toBe(userInfo.USER_ID);
    expect(user.wallet).toBeDefined();
    expect(user.wallet.walletStatus).toBe("ACTIVE");
    expect(user.wallet.walletAddress).toBeDefined();
    expect(user.user_kyc).toBeDefined();
    expect(user.user_kyc.status).toBe("PENDING");
    expect(user.ramps).toBeDefined();
    expect(user.ramps.usdAch.onRamp.status).toBe("PENDING");
    expect(user.ramps.usdAch.onRamp.achPull.achPullStatus).toBe("PENDING");
    expect(user.ramps.usdAch.offRamp.status).toBe("PENDING");
    expect(user.ramps.euroSepa.offRamp.status).toBe("PENDING");
  }, 30000);
});
