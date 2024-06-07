const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
const {createIndividualBridgeCustomer} = require('../../src/util/bridge/endpoint/createIndividualBridgeCustomer')
//missing 
createIndividualBridgeCustomer()