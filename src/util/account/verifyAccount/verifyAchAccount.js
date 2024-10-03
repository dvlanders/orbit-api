const fetch = require("node-fetch");
const createLog = require("../../logger/supabaseLogger");

const MICROBILT_CLIENT_ID = process.env.MICROBILT_CLIENT_ID;
const MICROBILT_CLIENT_SECRET = process.env.MICROBILT_CLIENT_SECRET;
const MICROBILT_URL = process.env.MICROBILT_URL;

// Microbilt's authentication token, it will be updated when it is expired.
let microbiltAuthToken = "";

const getMicrobiltAuthToken = async () => {
    const bodyObject = {
        client_id: MICROBILT_CLIENT_ID,
        client_secret: MICROBILT_CLIENT_SECRET,
        grant_type: "client_credentials",
    };

    const response = await fetch(`${MICROBILT_URL}/OAuth/Token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyObject),
    });

    const responseData = await response.json();

    if (response.ok) {
        return { activated: true, message: "", token: responseData.access_token };
    } else {
        return { activated: false, message: response.Error, token: "" };
    }
};

const verifyAchAccount = async (accountNumber, routingNumber) => {
    const bodyObject = {
        BankAccountNumber: accountNumber,
        BankRoutingNumber: routingNumber,
    };

    const performVerification = async (token) => {
        const verifyResponse = await fetch(
            `${MICROBILT_URL}/ABAAcctVerification/`,
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(bodyObject),
            }
        );

        const verifyResponseData = await verifyResponse.json();

        if (verifyResponse.ok) {
            if (verifyResponseData.MsgRsHdr.Status.StatusCode === 0) {
                // check routingNumber is verified
                if (verifyResponseData.DecisionInfo.Decision[0].DecisionCode === "A") {
                    // check accountNumber is verified
                    if (verifyResponseData.ABANumSchema === "VALID")
                        return { status: 200, message: "ACH is verifed successfully." };
                    else
                        return { status: 400, message: "provided Account Number has not been verified." };
                } else
                    return { status: 400, message: "provided Routing Number has not been verified." };
            } else
                return { status: 400, message: "provided Routing Number or Account Number has not been verified." };
        } else if (verifyResponse.status === 401) {     // token is invalid
            return { status: 401, message: "" };
        } else {
            return { status: 500, message: "Internal server error" };
        }
    };

    // check if microbiltAuthToken is empty
    if (!microbiltAuthToken) {
        const tokenResponse = await getMicrobiltAuthToken();
        if (!tokenResponse.activated) {
            await createLog("util/account/verifyAccount", null, "failed to authenticate Microbilt", tokenResponse.message );
            return { status: 500, message: tokenResponse.message };
        }
        microbiltAuthToken = tokenResponse.token;
    }

    let response = await performVerification(microbiltAuthToken);
    if (response.status === 401) {
        // get new token
        const tokenResponse = await getMicrobiltAuthToken();
        if (!tokenResponse.activated) {
            await createLog("util/account/verifyAccount", null, "failed to authenticate Microbilt", tokenResponse.message );
            return { status: 500, message: tokenResponse.message };
        }
        microbiltAuthToken = tokenResponse.token;
        response = await performVerification(microbiltAuthToken); // Retry with the new token
    }

    if (response.status === 200) {
        return { status: 200, message: "ACH is verifed successfully" };
    } else if (response.status === 400) {
        await createLog("util/account/verifyAccount", null, `failed to verify ACH with routingNumber: ${routingNumber}, accountNumber: ${accountNumber}`, response.message );
        return { status: 400, message: response.message };
    } else {
        await createLog("util/account/verifyAccount", null, `failed to verify ACH with routingNumber: ${routingNumber}, accountNumber: ${accountNumber}`, response.message );
        return { status: 500, message: "Internal server error" };
    }
};

module.exports = { verifyAchAccount }