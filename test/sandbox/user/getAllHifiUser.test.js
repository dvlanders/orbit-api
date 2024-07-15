const supertest = require("supertest");
const app = require("../../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const USER_ID = process.env.UID_USER_TEST;

describe("GET /user/all", function () {
  it("it should has status code 200", async () => {
    const allUsersRes = await supertest(app)
      .get(`/user/all?apiKeyId=${API_KEY}&userId=${USER_ID}&limit=1`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      })
      .expect(200);
    expect(allUsersRes.body.count).toBe(1);
    expect(allUsersRes.body.users).toBeDefined();
  }, 10000);
});
