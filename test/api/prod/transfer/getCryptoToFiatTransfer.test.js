const supertest = require("supertest");
const app = require("@/app");
const {
  authTestParams,
  getCryptoToFiatTransferParams,
} = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

const endpointCall = async (
  recordId,
  apiKey = authTestParams.API_KEY,
  zuploSecret = authTestParams.ZUPLO_SECRET
) => {
  return await supertest(app)
    .get(`/transfer/crypto-to-fiat?apiKeyId=${apiKey}&id=${recordId}`)
    .set({
      "zuplo-secret": zuploSecret,
      "Content-Type": "application/json", // Ensure correct content type
    });
};

describe("GET /transfer/crypto-to-fiat", function () {
  describe("Valid Get Transfer Test", function () {
    it("should have status code 200 for valid record Id", async () => {
      const txRes = await endpointCall(getCryptoToFiatTransferParams.RECORD_ID);

      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      console.log(tx);
      expect(tx.transferType).toBe("CRYPTO_TO_FIAT");
      expect(tx.transferDetails).toBeDefined();
      expect(tx.transferDetails.id).toBe(
        getCryptoToFiatTransferParams.RECORD_ID
      );
    }, 10000);
  });

  describe("Invalid Get Transfer Test", function () {
    const invalidRecordID = ["401a16c9-a9d8-40d6-a8d1-f85384e6aa80", "123abc"];

    invalidRecordID.forEach((recordId) => {
      it(`should have status code 404 for invalid record Id : ${recordId}`, async () => {
        const txRes = await endpointCall(recordId);

        expect(statusChecker(txRes, 404)).toBe(true);
        const tx = txRes.body;
        console.log(tx);
        expect(tx.error).toBe(`No transaction found for id: ${recordId}`);
      }, 10000);
    });
  });
});
