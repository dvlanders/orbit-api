const supertest = require("supertest");
const app = require("../../../../app");
const { v4: uuidv4 } = require("uuid");
const {
  authTestParams,
  transferCryptoFromWalletToBankAccountParams,
} = require("../testConfig");
const { statusChecker } = require("../../../testUtils");

const validParams = () => ({
  requestId: uuidv4(),
  sourceUserId: transferCryptoFromWalletToBankAccountParams.SOURCE_USER_ID,
  destinationUserId:
    transferCryptoFromWalletToBankAccountParams.DESTINATION_USER_ID,
  destinationAccountId:
    transferCryptoFromWalletToBankAccountParams.DESTINATION_ACCOUNT_ID,
  amount: 1,
  chain: "POLYGON_MAINNET",
  sourceCurrency: "usdc",
  destinationCurrency: "usd",
  paymentRail: "ach",
});

const endpointCall = async (
  params,
  apiKey = authTestParams.API_KEY,
  zuploSecret = authTestParams.ZUPLO_SECRET
) => {
  return await supertest(app)
    .post(`/transfer/crypto-to-fiat?apiKeyId=${apiKey}`)
    .set({
      "zuplo-secret": zuploSecret,
      "Content-Type": "application/json", // Ensure correct content type
    })
    .send(params);
};

describe("POST /transfer/crypto-to-fiat", function () {
  describe("Valid Transfer Test", function () {
    it("it should has status code 200", async () => {
      const txRes = await endpointCall(validParams());
      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      console.log(tx);
      expect(tx.transferType).toBe("CRYPTO_TO_FIAT");
      expect(tx.transferDetails).toBeDefined();
    }, 30000);
  });

  describe("Missing Fields Test", function () {
    const baseParams = validParams();
    delete baseParams.recipientUserId;

    const requiredFields = [
      "requestId",
      "destinationUserId",
      "destinationAccountId",
      "amount",
      "chain",
      "sourceCurrency",
      "destinationCurrency",
      "paymentRail",
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
        expect(tx.missingFields).toBeDefined();
        expect(tx.invalidFields).toBeDefined();
      }, 10000);
    });
  });

  describe("Request ID Test", function () {
    it(`should return status code 400 for invalid request ID`, async () => {
      const params = {
        ...validParams(),
        requestId: "12345",
      };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toBe("invalid requestId");
    }, 10000);

    it(`should return status code 400 for already exist request Id`, async () => {
      const params = {
        ...validParams(),
        requestId: transferCryptoFromWalletToBankAccountParams.EXIST_REQUEST_ID,
      };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toMatch(/^Request for requestId is already exists/);
    }, 10000);
  });

  describe("Unsupported Chain Test", function () {
    const unsupportedChain = ["RANDOM_MAINNET", "SOLANA_MAINNET"];
    unsupportedChain.forEach((chain) => {
      it(`should return status code 400 for unsupported chain ${chain}`, async () => {
        const params = { ...validParams(), chain: chain };
        const txRes = await endpointCall(params);
        expect(statusChecker(txRes, 400)).toBe(true);
        const tx = txRes.body;
        // console.log(account);
        expect(tx.error).toBe(`Unsupported chain: ${chain}`);
      }, 10000);
    });
  });

  describe("Unsupported Rail Test", function () {
    const unsupportedChain = [
      {
        paymentRail: "wire",
        sourceCurrency: "usdt",
        destinationCurrency: "usd",
      },
      {
        paymentRail: "ach",
        sourceCurrency: "usdc",
        destinationCurrency: "eur",
      },
      {
        paymentRail: "sepa",
        sourceCurrency: "usdc",
        destinationCurrency: "usd",
      },
    ];

    unsupportedChain.forEach(
      ({ paymentRail, sourceCurrency, destinationCurrency }) => {
        it(`should return status code 400 for ${paymentRail}: ${sourceCurrency} to ${destinationCurrency}`, async () => {
          const params = {
            ...validParams(),
            paymentRail,
            sourceCurrency,
            destinationCurrency,
          };
          const txRes = await endpointCall(params);
          expect(statusChecker(txRes, 400)).toBe(true);
          const tx = txRes.body;
          // console.log(account);
          expect(tx.error).toBe(
            `${paymentRail}: ${sourceCurrency} to ${destinationCurrency} is not a supported rail`
          );
        }, 10000);
      }
    );
  });

  describe("Invalid Amount Test", function () {
    const invalidAmounts = [0, "one", -1, 0.9];
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
    it(`should return status code 200 with failed status for exceed balance amount`, async () => {
      const params = { ...validParams(), amount: 100 };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      // console.log(tx);
      expect(tx.transferDetails).toBeDefined();
      expect(tx.transferDetails.status).toBe("NOT_INITIATED");
      expect(tx.transferDetails.failedReason).toMatch(
        "Transfer amount exceeds balance."
      );
    }, 30000);
  });

  describe("Invalid DestinationUserId and DestinationAccountId Pair Test", function () {
    it(`should return status code 400 if DestinationUserId does not own the DestinationAccountId`, async () => {
      const params = {
        ...validParams(),
        destinationAccountId:
          transferCryptoFromWalletToBankAccountParams.SOMEONE_ELSE_DESTINATION_ACCOUNT_ID,
      };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toBe(
        `Invalid destinationAccountId or unsupported rail for provided destinationAccountId`
      );
    }, 10000);
  });
});
