const supertest = require("supertest");
const app = require("@/app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

const USER_ID = "9708a575-5ff9-4008-8ff3-93d1b145d46e"

const activateOnRampRail = async (
  rail,
  destinationCurrency,
  destinationChain
) => {
  const accountRes = await supertest(app)
    .post(
      `/account/activateOnRampRail?apiKeyId=${authTestParams.API_KEY}&userId=${USER_ID}`
    )
    .set({
      "zuplo-secret": authTestParams.ZUPLO_SECRET,
      "Content-Type": "application/json",
    })
    .send({
      rail: rail,
      destinationCurrency: destinationCurrency,
      destinationChain: destinationChain,
    });

  expect(statusChecker(accountRes, 200)).toBe(true);
  const account = accountRes.body;
  console.log(account);
  console.log(
    `Account activated on ${rail} rail for ${destinationCurrency} on ${destinationChain}`
  );

    if (account.message.includes("successfully")) {
      expect(account.message).toBe(`${rail} create successfully`)
      expect(account.account).toBeDefined();
      const vAccount = account.account;
      expect(vAccount.virtualAccountId).toBeDefined();
      expect(vAccount.userId).toBe(USER_ID);
      expect(vAccount.destinationCurrency).toBe(destinationCurrency)
      expect(vAccount.destinationChain).toBe(destinationChain)
      expect(vAccount.railStatus).toBe("activated")
    } else if (account.message.includes("activated")) {
      expect(account.message).toBe("rail already activated");
    }

};

describe("POST /account/activateOnRampRail", function () {
  it("it should has status code 200", async () => {
    await activateOnRampRail("US_ACH_WIRE", "usdc", "POLYGON_MAINNET");
    await activateOnRampRail("US_ACH_WIRE", "usdc", "ETHEREUM_MAINNET");
    await activateOnRampRail("US_ACH_WIRE", "usdt", "ETHEREUM_MAINNET");
    await activateOnRampRail("US_ACH_WIRE", "usdc", "OPTIMISM_MAINNET");
    // TODO: is base mainnet supported?
    // await activateOnRampRail("US_ACH_WIRE", "usdc", "BASE_MAINNET");
  }, 30000);
});
