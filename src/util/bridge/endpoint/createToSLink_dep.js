const { v4: uuidv4 } = require('uuid');
const createLog = require("../../logger/supabaseLogger");
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;
const querystring = require('querystring');

const createToSLinkErrorType = {
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class createToSLinkError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, createToSLinkError.prototype);
	}
}

/**
 * This endpoint use to create bridge tos link, return url if success otherwise throw an error
 * @param {*} redirectUrl 
 * @returns 
 */

exports.createToSLink = async(redirectUrl) => {
    const idempotencyKey = uuidv4();
    try {
		const response = await fetch(`${BRIDGE_URL}/v0/customers/tos_links`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY
			}
		});

        const responseData = await response.json();
        if (response.status == 500){
			throw new createToSLinkError(createToSLinkErrorType.INTERNAL_ERROR, "Bridge Internal server error", responseData);
        }else if (!response.ok) {
			throw new createToSLinkError(createToSLinkErrorType.INTERNAL_ERROR, responseData.message, responseData);
		}


		const sessionUrl = responseData.url;
		const encodedRedirectUrl = querystring.escape(redirectUrl);
		const delimiter = sessionUrl.includes('?') ? '&' : '?';
		const fullUrl = `${sessionUrl}${delimiter}redirect_uri=${encodedRedirectUrl}`;

		return fullUrl
	} catch (error) {
        // should always be server error
        console.error(error)
		createLog("create/tos_link", "", error.message, error.rawResponse)
        throw new Error("Fail to create ToS link due to server error")
	}
}