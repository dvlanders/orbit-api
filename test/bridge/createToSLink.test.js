const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
const {createToSLink} = require('../../src/util/bridge/endpoint/createToSLink')

const test = async() => {

    const result = await createToSLink("http://localhost:3000/")
    console.log(result)

}

test()