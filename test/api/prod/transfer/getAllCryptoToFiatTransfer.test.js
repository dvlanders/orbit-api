const supertest = require("supertest");
const app = require("@/app");
const { authTestParams, userInfo } = require("../testConfig");
const { statusChecker } = require("@/test/testUtils");

const validParams = () => ({
  userId: userInfo.USER_ID,
});

const endpointCall = async (
  params,
  apiKey = authTestParams.API_KEY,
  zuploSecret = authTestParams.ZUPLO_SECRET
) => {
  const { userId, limit, createdAfter, createdBefore } = params;
  const queryParams = new URLSearchParams({
    apiKeyId: apiKey,
    userId,
    ...(limit ? { limit } : {}),
    ...(createdAfter ? { createdAfter } : {}),
    ...(createdBefore ? { createdBefore } : {}),
  }).toString();
  console.log(queryParams);

  return await supertest(app)
    .get(`/transfer/crypto-to-fiat/all?${queryParams}`)
    .set({
      "zuplo-secret": zuploSecret,
      "Content-Type": "application/json", // Ensure correct content type
    });
};

describe("GET /transfer/crypto-to-fiat/all", function () {
  describe("Valid Get Transfers Test", function () {
    it("it should has status code 200", async () => {
      const txsRes = await endpointCall(validParams());
      expect(statusChecker(txsRes, 200)).toBe(true);
      const txs = txsRes.body;
      console.log(txs);
      expect(txs.count).toBeDefined();
      expect(txs.records).toBeDefined();
      if (txs.count > 0) {
        expect(txs.records[0]).toBeDefined();
        expect(txs.records[0].transferType).toBe("CRYPTO_TO_FIAT");
        expect(txs.records[0].transferDetails).toBeDefined();
        console.log(txs.records[0].transferDetails);
      }
    }, 10000);
  });

  describe("Limit Test", function () {
    const validLimits = [1, 2, 5];
    const invalidLimits = [-1, "two"];

    validLimits.forEach((limit) => {
      it(`should return status code 200 for valid limit: ${limit}`, async () => {
        const params = { ...validParams(), limit };
        const txsRes = await endpointCall(params);
        expect(statusChecker(txsRes, 200)).toBe(true);
        const txs = txsRes.body;
        console.log(txs);
        expect(txs.count).toBe(limit);
        expect(txs.records).toHaveLength(limit);
        if (txs.count > 0) {
          expect(txs.records[0]).toBeDefined();
          expect(txs.records[0].transferType).toBe("CRYPTO_TO_FIAT");
          expect(txs.records[0].transferDetails).toBeDefined();
          console.log(txs.records[0].transferDetails);
        }
      }, 10000);
    });

    invalidLimits.forEach((limit) => {
      it(`should return status code 400 for invalid limit: ${limit}`, async () => {
        const params = { ...validParams(), limit };
        const txsRes = await endpointCall(params);
        expect(statusChecker(txsRes, 400)).toBe(true);
        const txs = txsRes.body;
        console.log(txs);
        expect(txs.error).toBe("Invalid limit");
      }, 10000);
    });
  });

  describe("Created Dates Test", function () {
    const validDates = [
      "2024-06-25",
      "2023-12-31T23:59:59Z",
      "2024-07-15T12:30:45Z",
      "2024-02-21T08:00:00Z",
    ]
    const invalidDates = [
      "1999-Jan-0",
      "13-2023-01",
      "2023-01-01 25:00:00",
      "abc123",
    ];
    const invalidDateRanges = [
      { fromDate: "2024-12-31T23:59:59Z", toDate: "2024-01-01T00:00:00Z" },
      { fromDate: "2023-12-25T00:00:00Z", toDate: "2023-12-24T23:59:59Z" },
      { fromDate: "2024-11-01T00:00:00Z", toDate: "2024-10-31T23:59:59Z" },
      { fromDate: "2024-03-15T15:00:00Z", toDate: "2024-03-15T14:59:59Z" },
    ];

    validDates.forEach((date) => {
      it(`should return status code 200 for valid created after date ${date}`, async () => {
        const params = { ...validParams(), createdAfter: date };
        const txsRes = await endpointCall(params);
        expect(statusChecker(txsRes, 200)).toBe(true);
        const txs = txsRes.body;
        console.log(txs);
        expect(txs.count).toBeDefined();
        expect(txs.records).toBeDefined();
        if (txs.count > 0) {
          expect(txs.records[0]).toBeDefined();
          expect(txs.records[0].transferType).toBe("CRYPTO_TO_FIAT");
          expect(txs.records[0].transferDetails).toBeDefined();
          console.log(txs.records[0].transferDetails);
        }
      }, 10000);

      it(`should return status code 200 for valid created before date ${date}`, async () => {
        const params = { ...validParams(), createdBefore: date };
        const txsRes = await endpointCall(params);
        expect(statusChecker(txsRes, 200)).toBe(true);
        const txs = txsRes.body;
        // console.log(txs);
        expect(txs.count).toBeDefined();
        expect(txs.records).toBeDefined();
        if (txs.count > 0) {
          expect(txs.records[0]).toBeDefined();
          expect(txs.records[0].transferType).toBe("CRYPTO_TO_FIAT");
          expect(txs.records[0].transferDetails).toBeDefined();
          console.log(txs.records[0].transferDetails);
        }
      }, 10000);
    });

    invalidDates.forEach((date) => {
      it(`should return status code 400 for invalid created after date ${date}`, async () => {
        const params = { ...validParams(), createdAfter: date };
        const txsRes = await endpointCall(params);
        expect(statusChecker(txsRes, 400)).toBe(true);
        const txs = txsRes.body;
        console.log(txs);
        expect(txs.error).toBe("Invalid date range");
      }, 10000);

      it(`should return status code 400 for invalid created before date ${date}`, async () => {
        const params = { ...validParams(), createdBefore: date };
        const txsRes = await endpointCall(params);
        expect(statusChecker(txsRes, 400)).toBe(true);
        const txs = txsRes.body;
        console.log(txs);
        expect(txs.error).toBe("Invalid date range");
      }, 10000);
    });

    invalidDateRanges.forEach(({ fromDate, toDate }) => {
      it(`should return status code 400 for invalid date range: created before date: ${toDate}, created after date: ${fromDate}`, async () => {
        const params = { ...validParams(), createdAfter: fromDate, createdBefore: toDate };
        const txsRes = await endpointCall(params);
        expect(statusChecker(txsRes, 400)).toBe(true);
        const txs = txsRes.body;
        console.log(txs);
        expect(txs.error).toBe("Invalid date range");
      }, 10000);
    })

  });
});
