const supertest = require("supertest");
const app = require("@/app");
const { authTestParams } = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

describe("GET /ping", function () {
  it("it should has status code 200", async () => {
    const pingRes = await supertest(app)
      .get(`/ping?apiKeyId=${authTestParams.API_KEY}`)
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
      });
    expect(statusChecker(pingRes, 200)).toBe(true);
  });
});
