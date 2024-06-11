const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
const {createBridgeVirtualAccount} = require('../../src/util/bridge/endpoint/createBridgeVirtualAccount')

createBridgeVirtualAccount("e03bbc4d-322e-41d7-8cce-4990b8b64212")