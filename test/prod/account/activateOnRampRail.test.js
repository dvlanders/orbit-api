const supertest = require("supertest");
const app = require("../../../app");
const { authTestParams, userInfo } = require("../testConfig");

const activateOnRampRail = async (
  rail,
  destinationCurrency,
  destinationChain
) => {
  const accountRes = await supertest(app)
    .post(
      `/account/activateOnRampRail?apiKeyId=${authTestParams.API_KEY}&userId=${userInfo.USER_ID}`
    )
    .set({
      "zuplo-secret": authTestParams.ZUPLO_SECRET,
      "Content-Type": "application/json",
    })
    .send({
      rail: rail,
      destinationCurrency: destinationCurrency,
      destinationChain: destinationChain,
    })
    .expect(200);

  const account = accountRes.body;
  console.log(account);
  console.log(
    `Account activated on ${rail} rail for ${destinationCurrency} on ${destinationChain}`
  );
  expect(account.message).toBeDefined();
  expect(account.message).toMatch(/(successfully|activated)$/);
};

describe("POST /account/activateOnRampRail", function () {
  it("it should has status code 200", async () => {
    await activateOnRampRail("US_ACH", "usdc", "POLYGON_MAINNET");
    await activateOnRampRail("US_ACH", "usdc", "ETHEREUM_MAINNET");
    await activateOnRampRail("US_ACH", "usdt", "ETHEREUM_MAINNET");
    await activateOnRampRail("US_ACH", "usdc", "OPTIMISM_MAINNET");
    // TODO: is base mainnet supported?
    // await activateOnRampRail("US_ACH", "usdc", "BASE_MAINNET");
  }, 30000);
});
