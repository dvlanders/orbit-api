const path = require('path');
const { v4 } = require('uuid');
const env = 'development';
const result = require("dotenv").config({ path: path.resolve(__dirname, `../../.env.${env}`), debug: env === "development" });
const userId = "86cfe494-b1b9-4509-af13-1a3744efccc5"
const apiKeyId = "ec8d5ce6-7e70-473f-97f7-9ca02d8c61b5"
const BASE_URL = "http://localhost:5001"
const ZUPLO_SECRET = process.env.ZUPLO_SECRET
let usOffRampAccountId


async function createUsdOffRamp() {
    try{
        url = `${BASE_URL}/account/usd/offramp?userId=${userId}&apiKeyId=${apiKeyId}`
        options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "zuplo-secret": ZUPLO_SECRET,
            },
            body: JSON.stringify({
                "currency": "usd",
                "bankName": "Chase",
                "accountOwnerName": "John Doe",
                "accountNumber": v4(), // not sure if works in prod
                "routingNumber": "000000017",
                "accountOwnerType": "individual",
                "streetLine1": "123 Main St",
                "city": "New York",
                "state": "NY",
                "postalCode": "10001",
                "country": "USA"
            })
        }

        const response = await fetch(url, options)
        const responseBody = await response.json()
        console.log(responseBody)
        if (!response.ok){
            return undefined
        }
        usOffRampAccountId = responseBody.id
        return responseBody
    }catch (error){
        console.error(error)
        throw(error)
    }

}

// create usd off ramp destination
describe('POST /account/usd/offramp', () => {
    it('create usd off ramp destination', async () => {
      const accountInfo = await createUsdOffRamp();
      expect(accountInfo).toBeDefined();
      expect(accountInfo.status).toBe("ACTIVE");
      expect(accountInfo.id).toBeDefined();
    });
  
  });

async function createEuOffRamp() {
    try{
        url = `${BASE_URL}/account/euro/offramp?userId=${userId}&apiKeyId=${apiKeyId}`
        options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "zuplo-secret": ZUPLO_SECRET,
            },
            body: JSON.stringify({
                "currency": "eur",
                "bankName": "Deutsche Bank",
                "accountOwnerName": "John Doe",
                "accountOwnerType": "individual",
                "ibanAccountNumber": "DE75512108001245126199",
                "country": "DEU",
                "businessIdentifierCode": "DEUTDEDBFRA",
                "ibanCountryCode": "DEU",
                "firstName": "John",
                "lastName": "Doe"
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

// create usd off ramp destination
describe('POST /account/euro/offramp', () => {
    it('create usd off ramp destination', async () => {
        if (env == "development"){
            return
        }
        const accountInfo = await createEuOffRamp();
        expect(accountInfo).toBeDefined();
        expect(accountInfo.status).toBe("ACTIVE");
        expect(accountInfo.id).toBeDefined();
    });
  
  });


async function getUsOffRampAccount() {
    try{
        url = `${BASE_URL}/account?userId=${userId}&apiKeyId=${apiKeyId}&accountId=${usOffRampAccountId}&accountType=usOfframp`
        options = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "zuplo-secret": ZUPLO_SECRET,
            },
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



// create usd off ramp destination
describe('GET /account', () => {
    it('get usd off ramp destination', async () => {
      const accountInfo = await getUsOffRampAccount();
      expect(accountInfo).toBeDefined();
      expect(accountInfo.data.id).toBe(usOffRampAccountId);
    });
  
  });


  
