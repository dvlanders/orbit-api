const supertest = require("supertest");
const { v4: uuidv4 } = require("uuid");
const app = require("../../app");
const { authTestParams, userInfo } = require("./testConfig");
const { statusChecker } = require("../testUtils");

const API_KEY = authTestParams.API_KEY;
const ZUPLO_SECRET = authTestParams.ZUPLO_SECRET;

describe("Create User Async Test", function () {
  let user_id;
  describe("Create User Async", () => {
    it("should create a user successfully", async () => {
      const tosLinkRes = await supertest(app)
        .post(`/tos-link?apiKeyId=${API_KEY}`)
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json",
        })
        .send({
          redirectUrl: "http://localhost:3000/tosredirect",
          idempotencyKey: uuidv4(),
        });

      expect(statusChecker(tosLinkRes, 200)).toBe(true);
      expect(tosLinkRes.body.url).toBeDefined();
      expect(tosLinkRes.body.sessionToken).toBeDefined();

      const sAIDRes = await supertest(app)
        .put(`/tos-link`)
        .set({
          "Content-Type": "application/json",
        })
        .send({
          sessionToken: tosLinkRes.body.sessionToken,
        });

      expect(statusChecker(sAIDRes, 200)).toBe(true);
      expect(sAIDRes.body.signedAgreementId).toBeDefined();

      const newUserRes = await supertest(app)
        .post(`/user/create/async?apiKeyId=${API_KEY}`)
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json",
        })
        .send({
          userType: "individual",
          legalFirstName: userInfo.FIRST_NAME,
          legalLastName: userInfo.LAST_NAME,
          complianceEmail: userInfo.EMAIL,
          compliancePhone: userInfo.PHONE,
          dateOfBirth: userInfo.DOB,
          taxIdentificationNumber: userInfo.TAX,
          govIdCountry: userInfo.GOV_ID_COUNTRY,
          govIdFront: userInfo.GOV_ID_FRONT,
          govIdBack: userInfo.GOV_ID_BACK,
          country: userInfo.COUNTRY,
          addressLine1: userInfo.ADDRESS,
          city: userInfo.CITY,
          postalCode: userInfo.POSTAL,
          stateProvinceRegion: userInfo.STATE,
          signedAgreementId: sAIDRes.body.signedAgreementId,
          ipAddress: "108.28.159.21",
        });

      expect(statusChecker(newUserRes, 200)).toBe(true);
      const user = newUserRes.body;
      console.log(user);
      expect(user).toBeDefined();
      expect(user.user.id).toBeDefined();
      user_id = user.user.id;
      expect(user.wallet).toBeDefined();
      expect(user.wallet.walletStatus).toBe("PENDING");
      expect(user.wallet.walletAddress).toBeDefined();
      expect(user.user_kyc).toBeDefined();
      expect(user.user_kyc.status).toBe("PENDING");
      expect(user.ramps).toBeDefined();
      expect(user.ramps.usdAch.onRamp.status).toBe("PENDING");
      expect(user.ramps.usdAch.onRamp.achPull.achPullStatus).toBe("PENDING");
      expect(user.ramps.usdAch.offRamp.status).toBe("PENDING");
      expect(user.ramps.euroSepa.onRamp.status).toBe("INACTIVE");
      expect(user.ramps.euroSepa.offRamp.status).toBe("PENDING");
    }, 30000);

    afterAll(() => {
      console.log(`Create User, user id: ${user_id}, completed successfully.`);
    });
  });

  describe("Get User", () => {
    it("should get the user successfully", async () => {
      expect(user_id).toBeDefined();
      const getUserWithActiveKYC = async () => {
        const userRes = await supertest(app)
          .get(`/user?apiKeyId=${API_KEY}&userId=${user_id}`)
          .set({
            "zuplo-secret": ZUPLO_SECRET,
            "Content-Type": "application/json",
          });

        expect(statusChecker(userRes, 200)).toBe(true);
        const user = userRes.body;
        expect(user).toBeDefined();
        expect(user.user.id).toBeDefined();
        expect(user.user.id).toBe(user_id);
        expect(user.wallet).toBeDefined();
        expect(user.wallet.walletAddress).toBeDefined();
        expect(user.user_kyc).toBeDefined();
        expect(user.user_kyc.status).toBeDefined();
        expect(user.ramps).toBeDefined();

        // Check if KYC status is ACTIVE, if not, wait and retry
        if (user.user_kyc.status !== "ACTIVE") {
          console.log(
            `Waiting for KYC status to become ACTIVE. Current status: ${user.user_kyc.status}`
          );
          await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 5 seconds before retrying
          return getUserWithActiveKYC(); // Recursively call until KYC status is ACTIVE
        } else {
          kyc_status = user.user_kyc.status;
          console.log(`KYC status is ACTIVE. Proceeding with tests.`);
        }
      };

      await getUserWithActiveKYC();
    }, 300000);

    afterAll(() => {
      console.log(
        `Get User, user id: ${user_id} with kyc status: ${kyc_status}, completed successfully.`
      );
    });
  });
});
