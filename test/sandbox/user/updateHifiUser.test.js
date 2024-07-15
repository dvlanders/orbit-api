const supertest = require("supertest");
const app = require("../../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_USER_TEST;

describe("PUT /user", function () {
  it("it should has status code 200", async () => {
    const userRes = await supertest(app)
      .put(`/user?apiKeyId=${API_KEY}&userId=${USER_ID}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .send({
        legalFirstName: "Test",
      })
      .expect(200);
    const user = userRes.body;
    expect(user).toBeDefined();
    expect(user.user.id).toBeDefined();
    expect(user.user.id).toBe(USER_ID);
    expect(user.wallet).toBeDefined();
    expect(user.wallet.walletStatus).toBe("ACTIVE");
    expect(user.wallet.walletAddress).toBeDefined();
    expect(user.user_kyc).toBeDefined();
    expect(user.ramps).toBeDefined();
  }, 10000);
});
