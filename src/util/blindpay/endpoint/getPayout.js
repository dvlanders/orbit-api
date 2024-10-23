const { GetPayoutErrorType, GetPayoutError } = require("../errors");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const getPayout = async (payoutId) => {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.BLINDPAY_API_KEY}`,
    "Content-Type": "application/json",
  };

  const url = `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/payouts/${payoutId}`;

  let response, responseBody;
  try {
    response = await fetchWithLogging(url, {
      method: "GET",
      headers: headers,
    }, "BLINDPAY");
    responseBody = await response.json();
  } catch (error) {
    throw new GetPayoutError(
      GetPayoutErrorType.INTERNAL_ERROR,
      500,
      "Blindpay API get payout fetch error or parsing error",
      error
    );
  }

  // console.log(responseBody);
  if (!response.ok) {
    console.error("Response not OK:", responseBody);
    throw new GetPayoutError(
      GetPayoutErrorType.INTERNAL_ERROR,
      500,
      "Blindpay get payout response not OK",
      responseBody
    );
  }

  return responseBody;
};

module.exports = {
  getPayout,
};
