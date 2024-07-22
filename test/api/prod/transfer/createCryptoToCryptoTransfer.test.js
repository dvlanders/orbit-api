const supertest = require("supertest");
const app = require("@/app");
const { v4: uuidv4 } = require("uuid");
const {
  authTestParams,
  userInfo,
  createCryptoToCryptoTransferParams,
} = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

const validParams = () => ({
  senderUserId: createCryptoToCryptoTransferParams.SENDER_USER_ID,
  amount: 0.01,
  requestId: uuidv4(),
  currency: "usdc",
  chain: "POLYGON_MAINNET",
  recipientUserId: createCryptoToCryptoTransferParams.RECIPIENT_USER_ID,
});

const endpointCall = async (
  params,
  userId = userInfo.USER_ID,
  apiKey = authTestParams.API_KEY,
  zuploSecret = authTestParams.ZUPLO_SECRET
) => {
  return await supertest(app)
    .post(`/transfer/crypto-to-crypto?apiKeyId=${apiKey}&userId=${userId}`)
    .set({
      "zuplo-secret": zuploSecret,
      "Content-Type": "application/json", // Ensure correct content type
    })
    .send(params);
};

describe("POST /transfer/crypto-to-crypto", function () {
  describe("Valid Transfer Test", function () {
    it("should return status code 200 for valid input parameters", async () => {
      const txRes = await endpointCall(validParams());
      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      console.log(tx);
      expect(tx.transferType).toBe("CRYPTO_TO_CRYPTO");
      expect(tx.transferDetails).toBeDefined();
    }, 30000);
  });

  describe("Missing Fields Test", function () {
    const baseParams = validParams();
    delete baseParams.recipientUserId;
    const requiredFields = [
      "senderUserId",
      "amount",
      "requestId",
      "currency",
      "chain",
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
  describe("Invalid RecipientUserId and RecipientAddress Test", function () {
    it(`should return status code 400 for missing recipientUserId and recipientAddress`, async () => {
      const params = validParams();
      delete params.recipientUserId;
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toBe(
        "Should provide either recipientUserId or recipientAddress"
      );
    }, 10000);
    it(`should return status code 400 for providing both recipientUserId and recipientAddress`, async () => {
      const params = validParams();
      params.recipientAddress =
        createCryptoToCryptoTransferParams.RECIPIENT_ADDRESS;
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toBe(
        "Should only provide either recipientUserId or recipientAddress"
      );
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
        expect(tx.error).toBe(`Chain ${chain} is not supported`);
      }, 10000);
    });
  });
  describe("Unsupported Currency Test", function () {
    const unsupportedCurrency = ["busd", "dai"];
    unsupportedCurrency.forEach((currency) => {
      it(`should return status code 400 for unsupported currency ${currency}`, async () => {
        const params = { ...validParams(), currency: currency };
        const txRes = await endpointCall(params);
        expect(statusChecker(txRes, 400)).toBe(true);
        const tx = txRes.body;
        // console.log(account);
        expect(tx.error).toBe(`Currency ${currency} is not supported`);
      }, 10000);
    });
  });
  describe("Request ID Unique Test", function () {
    it(`should return status code 400 for already exist request Id`, async () => {
      const params = {
        ...validParams(),
        requestId: createCryptoToCryptoTransferParams.EXIST_REQUEST_ID,
      };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 400)).toBe(true);
      const tx = txRes.body;
      // console.log(account);
      expect(tx.error).toMatch(/^Request for requestId is already exists/);
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
        expect(tx.error).toBe("Transfer amount must be greater than or equal to 0.01.");
      }, 10000);
    });

    it(`should return status code 200 with failed status for exceed balance amount`, async () => {
      const params = { ...validParams(), amount: 100 };
      const txRes = await endpointCall(params);
      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      // console.log(tx);
      expect(tx.transferDetails).toBeDefined();
      expect(tx.transferDetails.status).toBe("FAILED");
      expect(tx.transferDetails.failedReason).toMatch(
        "Transfer amount exceeds balance."
      );
    }, 30000);
  });
});
