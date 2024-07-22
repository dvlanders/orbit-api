const supertest = require("supertest");
const { v4: uuidv4 } = require("uuid");
const app = require("@/app");
const {
  authTestParams,
  userInfo,
  usdOfframpBankDetails,
  usdOnrampPlaidBankDetails,
} = require("./testConfig");
const { statusChecker } = require("@/test/testUtils");

const API_KEY = authTestParams.API_KEY;
const ZUPLO_SECRET = authTestParams.ZUPLO_SECRET;

const activateOnRampRail = async (
  user_id,
  rail,
  destinationCurrency,
  destinationChain
) => {
  const accountRes = await supertest(app)
    .post(`/account/activateOnRampRail?apiKeyId=${API_KEY}&userId=${user_id}`)
    .set({
      "zuplo-secret": ZUPLO_SECRET,
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
  expect(account.message).toBeDefined();
  expect(account.message).toMatch(/(successfully|activated)$/);
};

describe("User Flow: Create User -> Add Account -> Transfer", function () {
  let user_id,
    kyc_status,
    fiat_to_crypto_aid,
    crypto_to_fiat_aid,
    crypto_to_crypto_tx,
    fiat_to_crypto_tx,
    crypto_to_fiat_tx;

  describe("Create User", () => {
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
        .post(`/user/create?apiKeyId=${API_KEY}`)
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
        expect(user.wallet.walletStatus).toBe("ACTIVE");
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

  describe("Add Account", () => {
    it("should activate onramp rail successfully", async () => {
      await activateOnRampRail(user_id, "US_ACH", "usdc", "POLYGON_MAINNET");
      await activateOnRampRail(user_id, "US_ACH", "usdc", "ETHEREUM_MAINNET");
      await activateOnRampRail(user_id, "US_ACH", "usdt", "ETHEREUM_MAINNET");
      await activateOnRampRail(user_id, "US_ACH", "usdc", "OPTIMISM_MAINNET");
    }, 30000);

    it("should create usd offramp destination successfully", async () => {
      const accountRes = await supertest(app)
        .post(`/account/usd/offramp?apiKeyId=${API_KEY}&userId=${user_id}`)
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        })
        .send({
          currency: "usd",
          bankName: usdOfframpBankDetails.BANK_NAME,
          accountOwnerName: usdOfframpBankDetails.ACCOUNT_OWNER_NAME,
          accountNumber: usdOfframpBankDetails.ACCOUNT_NUMBER,
          routingNumber: usdOfframpBankDetails.ROUTING_NUMBER,
          streetLine1: usdOfframpBankDetails.STREET_LINE_1,
          city: usdOfframpBankDetails.CITY,
          state: usdOfframpBankDetails.STATE,
          postalCode: usdOfframpBankDetails.POSTAL_CODE,
          country: usdOfframpBankDetails.COUNTRY,
          accountOwnerType: "individual",
        });

      expect(statusChecker(accountRes, 200)).toBe(true);
      const account = accountRes.body;
      console.log(account);
      expect(accountRes.body.status).toBeDefined();
      expect(accountRes.body.status).toBe("ACTIVE");
      expect(accountRes.body.message).toBeDefined();
      expect(accountRes.body.id).toBeDefined();
    }, 30000);

    it("should create usd onramp source with Plaid successfully", async () => {
      const accountRes = await supertest(app)
        .post(`/account/usd/onramp/plaid?apiKeyId=${API_KEY}&userId=${user_id}`)
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        })
        .send({
          plaidProcessorToken: usdOnrampPlaidBankDetails.PLAID_TOKEN,
          accountType: usdOnrampPlaidBankDetails.ACCOUNT_TYPE,
          bankName: usdOnrampPlaidBankDetails.BANK_NAME,
        });

      expect(statusChecker(accountRes, 200)).toBe(true);
      const account = accountRes.body;
      console.log(account);
      expect(account.status).toBeDefined();
      expect(account.status).toBe("ACTIVE");
      expect(account.message).toBeDefined();
      expect(account.id).toBeDefined();
    }, 30000);

    afterAll(() => {
      console.log("Add Account tests completed successfully.");
    });
  });

  describe("Get Accounts", () => {
    it("should get onramp and offramp accounts successfully", async () => {
      const usOnrampAccountsRes = await supertest(app)
        .get(
          `/account/all?apiKeyId=${API_KEY}&railType=usOnRamp&userId=${user_id}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
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
        fiat_to_crypto_aid = usOnrampAccounts.banks[0].accountId;
      }
      const euOfframpAccountsRes = await supertest(app)
        .get(
          `/account/all?apiKeyId=${API_KEY}&railType=euOffRamp&userId=${user_id}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
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
          `/account/all?apiKeyId=${API_KEY}&railType=usOffRamp&userId=${user_id}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
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
        crypto_to_fiat_aid = usOfframpAccounts.banks[0].accountId;
      }
    }, 30000);

    afterAll(() => {
      console.log("Get Accounts tests completed successfully.");
    });
  });

  describe("Transfer", () => {
    it("should transfer crypto to crypto successfully", async () => {
      const accountRes = await supertest(app)
        .post(
          `/transfer/crypto-to-crypto?apiKeyId=${API_KEY}&userId=${user_id}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        })
        .send({
          senderUserId: user_id,
          amount: 0.01,
          requestId: uuidv4(),
          currency: "usdc",
          chain: "POLYGON_MAINNET",
          recipientUserId: user_id,
        });

      expect(statusChecker(accountRes, 200)).toBe(true);
      const account = accountRes.body;
      console.log(account);
      expect(account.transferType).toBeDefined();
      expect(account.transferType).toBe("CRYPTO_TO_CRYPTO");
      expect(account.transferDetails).toBeDefined();
    }, 10000);

    it("should transfer fiat to crypto successfully", async () => {
      expect(fiat_to_crypto_aid).toBeDefined();
      const accountRes = await supertest(app)
        .post(`/transfer/fiat-to-crypto?apiKeyId=${API_KEY}&userId=${user_id}`)
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        })
        .send({
          requestId: uuidv4(),
          sourceUserId: user_id,
          sourceAccountId: fiat_to_crypto_aid,
          amount: 1,
          chain: "POLYGON_MAINNET",
          sourceCurrency: "usd",
          destinationCurrency: "usdc",
          isInstant: false,
          destinationUserId: user_id,
        });

      expect(statusChecker(accountRes, 200)).toBe(true);
      const account = accountRes.body;
      console.log(account);
      expect(account.transferType).toBeDefined();
      expect(account.transferType).toBe("FIAT_TO_CRYPTO");
      expect(account.transferDetails).toBeDefined();
    }, 10000);

    it("should transfer crypto to fiat successfully", async () => {
      expect(crypto_to_fiat_aid).toBeDefined();
      const accountRes = await supertest(app)
        .post(`/transfer/crypto-to-fiat?apiKeyId=${API_KEY}&userId=${user_id}`)
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        })
        .send({
          requestId: uuidv4(),
          sourceUserId: user_id,
          destinationUserId: user_id,
          destinationAccountId: crypto_to_fiat_aid,
          amount: 1,
          chain: "POLYGON_MAINNET",
          sourceCurrency: "usdc",
          destinationCurrency: "usd",
          paymentRail: "ach",
        });

      expect(statusChecker(accountRes, 200)).toBe(true);
      const account = accountRes.body;
      console.log(account);
      expect(account.transferType).toBeDefined();
      expect(account.transferType).toBe("CRYPTO_TO_FIAT");
      expect(account.transferDetails).toBeDefined();
    }, 10000);

    afterAll(() => {
      console.log("All Transfer tests completed successfully.");
    });
  });

  describe("Get All Transfer", () => {
    it("should get all crypto to crypto transfer successfully", async () => {
      const txsRes = await supertest(app)
        .get(
          `/transfer/crypto-to-crypto/all?apiKeyId=${API_KEY}&userId=${user_id}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        });

      expect(statusChecker(txsRes, 200)).toBe(true);
      const txs = txsRes.body;
      console.log(txs);
      expect(txs.count).toBeDefined();
      expect(txs.records).toBeDefined();
      if (txs.count > 0) {
        expect(txs.records[0].transferType).toBeDefined();
        expect(txs.records[0].transferType).toBe("CRYPTO_TO_CRYPTO");
        expect(txs.records[0].transferDetails).toBeDefined();
        expect(txs.records[0].transferDetails.id).toBeDefined();
        console.log(txs.records[0].transferDetails);
        crypto_to_crypto_tx = txs.records[0].transferDetails.id;
      }
    }, 10000);

    it("should get all fiat to crypto transfer successfully", async () => {
      const txsRes = await supertest(app)
        .get(
          `/transfer/fiat-to-crypto/all?apiKeyId=${API_KEY}&userId=${user_id}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        });

      expect(statusChecker(txsRes, 200)).toBe(true);
      const txs = txsRes.body;
      console.log(txs);
      expect(txs.count).toBeDefined();
      expect(txs.records).toBeDefined();
      if (txs.count > 0) {
        expect(txs.records[0].transferType).toBeDefined();
        expect(txs.records[0].transferType).toBe("FIAT_TO_CRYPTO");
        expect(txs.records[0].transferDetails).toBeDefined();
        expect(txs.records[0].transferDetails.id).toBeDefined();
        console.log(txs.records[0].transferDetails);
        fiat_to_crypto_tx = txs.records[0].transferDetails.id;
      }
    }, 10000);

    it("should get all crypto to fiat transfer successfully", async () => {
      const txsRes = await supertest(app)
        .get(
          `/transfer/crypto-to-fiat/all?apiKeyId=${API_KEY}&userId=${user_id}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        });

      expect(statusChecker(txsRes, 200)).toBe(true);
      const txs = txsRes.body;
      console.log(txs);
      expect(txs.count).toBeDefined();
      expect(txs.records).toBeDefined();
      if (txs.count > 0) {
        expect(txs.records[0].transferType).toBeDefined();
        expect(txs.records[0].transferType).toBe("CRYPTO_TO_FIAT");
        expect(txs.records[0].transferDetails).toBeDefined();
        expect(txs.records[0].transferDetails.id).toBeDefined();
        console.log(txs.records[0].transferDetails);
        crypto_to_fiat_tx = txs.records[0].transferDetails.id;
      }
    }, 10000);

    afterAll(() => {
      console.log("Get All Transfer tests completed successfully.");
    });
  });

  describe("Get Specific Transfer", () => {
    it("should get most recent crypto to crypto transfer successfully", async () => {
      expect(crypto_to_crypto_tx).toBeDefined();
      const txRes = await supertest(app)
        .get(
          `/transfer/crypto-to-crypto?apiKeyId=${API_KEY}&id=${crypto_to_crypto_tx}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        });

      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      console.log(tx);
      expect(tx.transferType).toBeDefined();
      expect(tx.transferType).toBe("CRYPTO_TO_CRYPTO");
      expect(tx.transferDetails).toBeDefined();
      expect(tx.transferDetails.id).toBeDefined();
      expect(tx.transferDetails.id).toBe(crypto_to_crypto_tx);
    }, 10000);

    it("should get most recent crypto to fiat transfer successfully", async () => {
      expect(crypto_to_fiat_tx).toBeDefined();
      const txRes = await supertest(app)
        .get(
          `/transfer/crypto-to-fiat?apiKeyId=${API_KEY}&id=${crypto_to_fiat_tx}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        });

      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      console.log(tx);
      expect(tx.transferType).toBeDefined();
      expect(tx.transferType).toBe("CRYPTO_TO_FIAT");
      expect(tx.transferDetails).toBeDefined();
      expect(tx.transferDetails.id).toBeDefined();
      expect(tx.transferDetails.id).toBe(crypto_to_fiat_tx);
    }, 10000);

    it("should get most recent fiat to crypto transfer successfully", async () => {
      expect(fiat_to_crypto_tx).toBeDefined();
      const txRes = await supertest(app)
        .get(
          `/transfer/fiat-to-crypto?apiKeyId=${API_KEY}&id=${fiat_to_crypto_tx}`
        )
        .set({
          "zuplo-secret": ZUPLO_SECRET,
          "Content-Type": "application/json", // Ensure correct content type
        });

      expect(statusChecker(txRes, 200)).toBe(true);
      const tx = txRes.body;
      console.log(tx);
      expect(tx.transferType).toBeDefined();
      expect(tx.transferType).toBe("FIAT_TO_CRYPTO");
      expect(tx.transferDetails).toBeDefined();
      expect(tx.transferDetails.id).toBeDefined();
      expect(tx.transferDetails.id).toBe(fiat_to_crypto_tx);
    }, 10000);

    afterAll(() => {
      console.log("Get Specific Transfer tests completed successfully.");
    });
  });

  afterAll(() => {
    console.log("All User Flow tests completed successfully.");
  });
});
