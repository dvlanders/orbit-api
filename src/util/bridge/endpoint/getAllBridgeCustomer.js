const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

exports.getAllBridgeCustomer = async() => {
    try {
        const response = await fetch(`${BRIDGE_URL}/v0/customers` , {
            headers: {
                accept: 'application/json',
                'Api-Key': BRIDGE_API_KEY
            }
        })

        const responseBody = await response.json()
        console.log(responseBody) 

    }catch (error){
        console.error(error)
    }
}