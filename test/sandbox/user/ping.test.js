const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams } = require("../testConfig");

describe("GET /ping", function () {
  it("it should has status code 200", async () => {
    await supertest(app)
      .get(`/ping?apiKeyId=${authTestParams.API_KEY}`)
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
      })
      .expect(200);
  });
});
