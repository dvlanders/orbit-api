const supertest = require("supertest");
const { v4: uuidv4 } = require("uuid");
const app = require("../../../app");
const API_KEY = process.env.API_KEY_TEST;
const ZUPLO_SECRET = process.env.ZUPLO_SECRET;
const FIRST_NAME = process.env.FIRST_NAME_USER_TEST;

describe("POST /user/create", function () {
  it("it should has status code 200", async () => {
    const tosLinkRes = await supertest(app)
      .post(`/tos-link?apiKeyId=${API_KEY}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json",
      })
      .send({
        redirectUrl: "http://localhost:3000/tosredirect",
        idempotencyKey: uuidv4(),
      })
      .expect(200);

    expect(tosLinkRes.body.url).toBeDefined();
    expect(tosLinkRes.body.sessionToken).toBeDefined();

    const sAIDResponse = await supertest(app)
      .put(`/tos-link`)
      .set({
        "Content-Type": "application/json",
      })
      .send({
        sessionToken: tosLinkRes.body.sessionToken,
      })
      .expect(200);

    expect(sAIDResponse.body.signedAgreementId).toBeDefined();

    const newUserRes = await supertest(app)
      .post(`/user/create?apiKeyId=${API_KEY}`)
      .set({
        "zuplo-secret": ZUPLO_SECRET,
        "Content-Type": "application/json",
      })
      .send({
        userType: "individual",
        legalFirstName: FIRST_NAME,
        legalLastName: "Test",
        complianceEmail: "test@gmail.com",
        compliancePhone: "+19144386656",
        dateOfBirth: "2000-05-21",
        taxIdentificationNumber: "323009358",
        govIdCountry: "TW",
        country: "USA",
        addressLine1: "test address",
        city: "NV",
        postalCode: "10044",
        stateProvinceRegion: "NV",
        signedAgreementId: sAIDResponse.body.signedAgreementId,
        ipAddress: "108.28.159.21",
      })
      .expect(200);

    const user = newUserRes.body;
    expect(user).toBeDefined();
    expect(user.user.id).toBeDefined();
    expect(user.wallet).toBeDefined();
    expect(user.wallet.walletStatus).toBe("ACTIVE");
    expect(user.wallet.walletAddress).toBeDefined();
    expect(user.user_kyc).toBeDefined();
    expect(user.user_kyc.status).toBe("PENDING");
    expect(user.ramps).toBeDefined();
    expect(user.ramps.usdAch.onRamp.status).toBe("PENDING");
    expect(user.ramps.usdAch.onRamp.achPull.achPullStatus).toBe("PENDING");
    expect(user.ramps.usdAch.offRamp.status).toBe("PENDING");
    expect(user.ramps.euroSepa.offRamp.status).toBe("PENDING");
  }, 30000);
});
