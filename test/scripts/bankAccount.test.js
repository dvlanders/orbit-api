const path = require('path');
const env = 'development';
const result = require("dotenv").config({ path: path.resolve(__dirname, `../../.env.${env}`), debug: env === "development" });
const userId = "f8642d58-182d-42df-99d5-036315f2c27a"
const apiKeyId = "ec8d5ce6-7e70-473f-97f7-9ca02d8c61b5"

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
                "accountNumber": "1234567876",
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
            return it.skip("skipping test in sandbox")
        }
        const accountInfo = await createEuOffRamp();
        expect(accountInfo).toBeDefined();
        expect(accountInfo.status).toBe("ACTIVE");
        expect(accountInfo.id).toBeDefined();
    });
  
  });