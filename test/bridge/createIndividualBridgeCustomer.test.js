const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
const {createIndividualBridgeCustomer} = require('../../src/util/bridge/endpoint/createIndividualBridgeCustomer')


const test = async() => {
    const result = await createIndividualBridgeCustomer("e03bbc4d-322e-41d7-8cce-4990b8b64212")
    console.log(result)
}

test()