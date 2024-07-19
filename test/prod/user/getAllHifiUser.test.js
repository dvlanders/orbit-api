const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams } = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("GET /user/all", function () {
  it("it should has status code 200", async () => {
    const allUsersRes = await supertest(app)
      .get(`/user/all?apiKeyId=${authTestParams.API_KEY}&limit=1`)
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(allUsersRes, 200)).toBe(true);
    const allUsers = allUsersRes.body;
    console.log(allUsers);
    expect(allUsers.count).toBeDefined();
    expect(allUsers.count).toBe(1);
    expect(allUsers.users).toBeDefined();
  }, 30000);
});
