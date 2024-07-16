const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");

describe("GET /user/all", function () {
  it("it should has status code 200", async () => {
    const allUsersRes = await supertest(app)
      .get(
        `/user/all?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}&limit=1`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);
    expect(allUsersRes.body.count).toBe(1);
    expect(allUsersRes.body.users).toBeDefined();
  }, 10000);
});
