const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
const {getBridgeCustomer} = require('../../src/util/bridge/endpoint/getBridgeCustomer')


getBridgeCustomer()