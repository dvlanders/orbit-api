const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
const {getAllBridgeCustomer} = require('../../src/util/bridge/endpoint/getAllBridgeCustomer')


getAllBridgeCustomer()