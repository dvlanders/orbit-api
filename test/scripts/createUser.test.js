const { v4 } = require("uuid");
const path = require('path');
const env = 'development';
const result = require("dotenv").config({ path: path.resolve(__dirname, `../../.env.${env}`), debug: env === "development" });
const signedAgreementId = v4()
const templateId = "2fb2da24-472a-4e5b-b160-038d9dc82a40"
const BASE_URL = "http://localhost:5001"
const ZUPLO_SECRET = process.env.ZUPLO_SECRET
const apiKeyId = "ec8d5ce6-7e70-473f-97f7-9ca02d8c61b5"
let sessionToken

async function generateToSLink() {
    try{
        url = `${BASE_URL}/tos-link`
        options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "zuplo-secret": ZUPLO_SECRET,
            },
            body: JSON.stringify({
                "redirectUrl": "http://localhost:3000/tosredirect",
                "idempotencyKey": signedAgreementId,
                "templateId": templateId
            })
        }

        const response = await fetch(url, options)
        if (!response.ok){
            return undefined
        }
        const responseBody = await response.json()
        return responseBody
    }catch (error){
        console.error(error)
        throw(error)
    }

}

// generate tos link
describe('POST /tos-link', () => {
    it('generate tos link', async () => {
      const tosInfo = await generateToSLink();
      expect(tosInfo).toBeDefined();
      expect(tosInfo.sessionToken).toBeDefined();
      expect(tosInfo.url).toBeDefined();
      sessionToken = tosInfo.sessionToken
    });
  
  });

async function acceptToSlink() {
    try{
        url = `${BASE_URL}/tos-link`
        options = {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "zuplo-secret": ZUPLO_SECRET,
            },
            body: JSON.stringify({
                "sessionToken": sessionToken,
            })
        }

        const response = await fetch(url, options)
        const responseBody = await response.json()
        if (!response.ok){
            return undefined
        }
        return responseBody
    }catch (error){
        console.error(error)
        throw(error)
    }
}

// accept tos link
describe('PUT /tos-link', () => {
    it('accept tos link', async () => {
      const tosInfo = await acceptToSlink();
      expect(tosInfo).toBeDefined();
      expect(tosInfo.signedAgreementId).toBeDefined();
      expect(tosInfo.signedAgreementId).toBe(signedAgreementId);

    });
  
  });

async function createUser() {
    try{
        url = `${BASE_URL}/user/create?apiKeyId=${apiKeyId}`
        options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "zuplo-secret": ZUPLO_SECRET,
            },
            body: JSON.stringify({
                "userType": "individual",
                "legalFirstName": "William",
                "legalLastName": "YANG",
                "complianceEmail": "william@hifibridge.com",
                "compliancePhone": "+19144386656",
                "dateOfBirth": "2000-05-21",
                "taxIdentificationNumber": "373898358",
                "govIdCountry": "TW",
                "country": "USA",
                "addressLine1": "effjhefefefef",
                "city": "NV",
                "postalCode": "10044",
                "stateProvinceRegion": "NV",
                "signedAgreementId": signedAgreementId,
                "ipAddress": "108.28.159.21",
                "govIdFront": "https://pqgnrjvoqbopfaxmlhlv.supabase.co/storage/v1/object/sign/compliance_id/4075c5ba-dfa3-4886-a693-6505728571d3/gov_id_front?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJjb21wbGlhbmNlX2lkLzQwNzVjNWJhLWRmYTMtNDg4Ni1hNjkzLTY1MDU3Mjg1NzFkMy9nb3ZfaWRfZnJvbnQiLCJpYXQiOjE3MTg3Mjc1NDcsImV4cCI6MTc1MDI2MzU0N30.uLrPMwmYYoURCbuBYV-nRKET0nQQ37UoMjvIRv3ZEqk&t=2024-06-18T16%3A19%3A07.430Z",
                "govIdBack": "https://pqgnrjvoqbopfaxmlhlv.supabase.co/storage/v1/object/sign/compliance_id/4075c5ba-dfa3-4886-a693-6505728571d3/gov_id_front?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJjb21wbGlhbmNlX2lkLzQwNzVjNWJhLWRmYTMtNDg4Ni1hNjkzLTY1MDU3Mjg1NzFkMy9nb3ZfaWRfZnJvbnQiLCJpYXQiOjE3MTg3Mjc1NDcsImV4cCI6MTc1MDI2MzU0N30.uLrPMwmYYoURCbuBYV-nRKET0nQQ37UoMjvIRv3ZEqk&t=2024-06-18T16%3A19%3A07.430Z",
                "proofOfResidency": "https://pqgnrjvoqbopfaxmlhlv.supabase.co/storage/v1/object/sign/compliance_id/4075c5ba-dfa3-4886-a693-6505728571d3/gov_id_front?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJjb21wbGlhbmNlX2lkLzQwNzVjNWJhLWRmYTMtNDg4Ni1hNjkzLTY1MDU3Mjg1NzFkMy9nb3ZfaWRfZnJvbnQiLCJpYXQiOjE3MTg3Mjc1NDcsImV4cCI6MTc1MDI2MzU0N30.uLrPMwmYYoURCbuBYV-nRKET0nQQ37UoMjvIRv3ZEqk&t=2024-06-18T16%3A19%3A07.430Z",
            })
        }

        const response = await fetch(url, options)
        const responseBody = await response.json()
        if (response.status == 500){
            return undefined
        }
        return responseBody
    }catch (error){
        console.error(error)
        throw(error)
    }
}

//  create user
describe('POST /user/create', () => {
    it('create user', async () => {
      const user = await createUser();
      expect(user).toBeDefined();
      expect(user.user.id).toBeDefined();
      userId = user.user.id
      expect(user.wallet).toBeDefined();
      expect(user.wallet.walletStatus).toBe("ACTIVE");
      expect(user.wallet.walletAddress.ETHEREUM_TESTNET).toBeDefined();
      expect(typeof user.wallet.walletAddress.ETHEREUM_TESTNET.address).toBe('string');
      expect(user.user_kyc).toBeDefined()
      expect(user.user_kyc.status).toBe("PENDING")
      expect(user.ramps).toBeDefined()
      expect(user.ramps.usdAch.onRamp.status).toBe("PENDING")
      expect(user.ramps.usdAch.onRamp.achPull.achPullStatus).toBe("PENDING")
      expect(user.ramps.usdAch.offRamp.status).toBe("PENDING")
      expect(user.ramps.euroSepa.offRamp.status).toBe("PENDING")
    }, 10000);
  
  });

async function getUser(){
    url = `${BASE_URL}/user?userId=${userId}&apiKeyId=${apiKeyId}`
    options = {
        headers: {
            "Content-Type": "application/json",
            "zuplo-secret": ZUPLO_SECRET,
        },
    }
    const response = await fetch(url, options)
    const responseBody = await response.json()
    if (!response.ok){
        console.log(responseBody)
        return undefined
    }
    return responseBody
}

//  get user
describe('GET /user', () => {
    it('get user', async () => {
      const user = await getUser();
      expect(user).toBeDefined();
      expect(user.user.id).toBeDefined();
      expect(user.user.id).toBe(userId);
    });
  
  });






