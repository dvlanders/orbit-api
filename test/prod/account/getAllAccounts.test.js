const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("../../testUtils");

describe("GET /account/all", function () {
  it("it should has status code 200", async () => {
    const usOnrampAccountsRes = await supertest(app)
      .get(
        `/account/all?apiKeyId=${authTestParams.API_KEY}&railType=usOnRamp&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(usOnrampAccountsRes, 200)).toBe(true);
    const usOnrampAccounts = usOnrampAccountsRes.body;
    console.log(usOnrampAccounts);
    expect(usOnrampAccounts.count).toBeDefined();
    expect(usOnrampAccounts.banks).toBeDefined();
    expect(usOnrampAccounts.railType).toBeDefined();
    expect(usOnrampAccounts.railType).toBe("usOnRamp");

    if (usOnrampAccounts.count > 0) {
      console.log(usOnrampAccounts.banks[0].accountId);
    }
    const euOfframpAccountsRes = await supertest(app)
      .get(
        `/account/all?apiKeyId=${authTestParams.API_KEY}&railType=euOffRamp&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(euOfframpAccountsRes, 200)).toBe(true);
    const euOfframpAccounts = euOfframpAccountsRes.body;
    console.log(euOfframpAccounts);
    expect(euOfframpAccounts.count).toBeDefined();
    expect(euOfframpAccounts.banks).toBeDefined();
    expect(euOfframpAccounts.railType).toBeDefined();
    expect(euOfframpAccounts.railType).toBe("euOffRamp");

    if (euOfframpAccounts.count > 0) {
      console.log(euOfframpAccounts.banks[0].accountId);
    }
    const usOfframpAccountsRes = await supertest(app)
      .get(
        `/account/all?apiKeyId=${authTestParams.API_KEY}&railType=usOffRamp&userId=${userInfo.USER_ID}`
      )
      .set({
        "zuplo-secret": authTestParams.ZUPLO_SECRET,
        "Content-Type": "application/json", // Ensure correct content type
      });

    expect(statusChecker(usOfframpAccountsRes, 200)).toBe(true);
    const usOfframpAccounts = usOfframpAccountsRes.body;
    console.log(usOfframpAccounts);
    expect(usOfframpAccounts.count).toBeDefined();
    expect(usOfframpAccounts.banks).toBeDefined();
    expect(usOfframpAccounts.railType).toBeDefined();
    expect(usOfframpAccounts.railType).toBe("usOffRamp");

    if (usOfframpAccounts.count > 0) {
      console.log(usOfframpAccounts.banks[0].accountId);
    }
  }, 10000);
});
