const supertest = require("supertest");
const app = require("../../app");
const API_KEY = process.env.API_KEY_TEST;

describe("GET /ping", function () {
  it("it should has status code 200", async () => {
    await supertest(app)
      .get(`/ping?apiKeyId=${API_KEY}`)
      .set({
        "zuplo-secret": process.env.ZUPLO_SECRET,
      })
      .expect(200);
  });
});
