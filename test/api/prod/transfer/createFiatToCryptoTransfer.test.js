const supertest = require("supertest");
const app = require("../../../../app");
const { v4: uuidv4 } = require("uuid");
const {
  authTestParams,
  createFiatToCryptoTransferParams,
} = require("../testConfig");
const { statusChecker } = require("../../../testUtils");

const validParams = () => ({
  requestId: uuidv4(),
  sourceUserId: createFiatToCryptoTransferParams.SOURCE_USER_ID,
  sourceAccountId: createFiatToCryptoTransferParams.SOURCE_ACCOUNT_ID,
  amount: 1,
  chain: "POLYGON_MAINNET",
  sourceCurrency: "usd",
  destinationCurrency: "usdc",
  isInstant: false,
  destinationUserId: createFiatToCryptoTransferParams.DESTINATION_USER_ID,
});

const endpointCall = async (
  params,
  apiKey = authTestParams.API_KEY,
  zuploSecret = authTestParams.ZUPLO_SECRET
) => {
  return await supertest(app)
    .post(`/transfer/fiat-to-crypto?apiKeyId=${apiKey}`)
    .set({
      "zuplo-secret": zuploSecret,
      "Content-Type": "application/json", // Ensure correct content type
    })
    .send(params);
};

describe("POST /transfer/fiat-to-crypto", function () {
  describe("Valid Transfer Test", function () {
    it("should return status code 200", async () => {
      const txRes = await endpointCall(validParams());

      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      console.log(tx);
      expect(tx.transferType).toBe("FIAT_TO_CRYPTO");
      expect(tx.transferDetails).toBeDefined();
    }, 10000);
  });

  describe("Missing Fields Test", function () {
    const baseParams = validParams();
    delete baseParams.recipientUserId;

    const requiredFields = [
      "requestId",
      "destinationUserId",
      "amount",
      "sourceCurrency",
      "destinationCurrency",
      "chain",
      "sourceAccountId",
      "isInstant",
    ];

    requiredFields.forEach((field) => {
      it(`should return status code 400 for missing ${field}`, async () => {
        const params = validParams();
        delete params[field];
        const txRes = await endpointCall(params);
        expect(statusChecker(txRes, 400)).toBe(true);
        const tx = txRes.body;
        // console.log(account);
        expect(tx.error).toBe("fields provided are either missing or invalid");
        expect(tx.missing_fields).toBeDefined();
        expect(tx.invalid_fields).toBeDefined();
      }, 10000);
    });
  });

  describe("Unsupported Fiat Crypto Pair Test", function () {
    const unsupportedChain = [
      {
        sourceCurrency: "eur",
        chain: "POLYGON_MAINNET",
        destinationCurrency: "usdc",
      },
      {
        sourceCurrency: "usd",
        chain: "POLYGON_MAINNET",
        destinationCurrency: "usdt",
      },
      {
        sourceCurrency: "usd",
        chain: "ETHEREUM_MAINNET",
        destinationCurrency: "busd",
      },
    ];

    unsupportedChain.forEach(
      ({ sourceCurrency, destinationCurrency, chain }) => {
        it(`should return status code 400 for ${sourceCurrency} to ${destinationCurrency} on ${chain}`, async () => {
          const params = {
            ...validParams(),
            sourceCurrency,
            destinationCurrency,
            chain,
          };
          const txRes = await endpointCall(params);
          expect(statusChecker(txRes, 400)).toBe(true);
          const tx = txRes.body;
          // console.log(account);
          expect(tx.error).toBe(
            `Unsupported rail for ${sourceCurrency} to ${destinationCurrency} on ${chain}`
          );
        }, 10000);
      }
    );
  });

  describe("Request ID Unique Test", function () {
    it(`should return status code 400 for already exist request Id`, async () => {
      const params = {
        ...validParams(),
        requestId: createFiatToCryptoTransferParams.EXIST_REQUEST_ID,
      };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toMatch(/^Request for requestId is already exists/);
    }, 10000);
  });

  describe("Bridge Plaid Rail Test", function () {
    it(`should return status code 400 if no Plaid checkbook account bind to sourceAccountId/sourceUserId`, async () => {
      const params = {
        ...validParams(),
        sourceAccountId:
          createFiatToCryptoTransferParams.NONE_PLAID_CHECKBOOK_ACCOUNT_ID,
      };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toBe("No resource found for provided sourceAccountId");
    }, 10000);
  });

  describe("Bridge Virtual Account Test", function () {
    it(`should return status code 400 if no Bridge virtual account for the rail for the destination User ID`, async () => {
      const params = {
        ...validParams(),
        destinationUserId:
          createFiatToCryptoTransferParams.INACTIVE_RAIL_USER_ID,
      };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toBe(
        "No resource found for provided sourceCurrency, destinationCurrency, chain for provided destinationUserId, please use account/activateOnRampRail to create a rail first"
      );
    }, 10000);
  });

  describe("Invalid Amount Test", function () {
    const invalidAmounts = [0, "one", -1];
    invalidAmounts.forEach((amount) => {
      it(`should return status code 400 with failed status for invalid amount`, async () => {
        const params = { ...validParams(), amount: amount };
        const txRes = await endpointCall(params);
        expect(statusChecker(txRes, 400)).toBe(true);
        const tx = txRes.body;
        console.log(tx);
        expect(tx.error).toBe("Transfer amount must be greater than or equal to 1.");
      }, 10000);
    });
    it(`should return status code 400 with failed status sending limit exceeded`, async () => {
      const params = { ...validParams(), amount: 1000000 };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(tx);
      expect(tx.error).toMatch("Exceed transfer amount limit.");
    }, 10000);
  });
});
