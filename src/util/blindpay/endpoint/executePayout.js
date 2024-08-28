const { ExecutePayoutErrorType, ExecutePayoutError } = require("../errors");

const executePayout = async (quoteId, fromWalletAddress) => {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.BLINDPAY_API_KEY}`,
    "Content-Type": "application/json",
  };

  const payoutRequestBody = {
    "quote_id": quoteId,
    "sender_wallet_address": fromWalletAddress
  }

  const url = `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/payouts/evm`;

  let response, responseBody;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payoutRequestBody)
    });
    responseBody = await response.json();
  } catch (error) {
    throw new ExecutePayoutError(
      ExecutePayoutErrorType.INTERNAL_ERROR,
      500,
      "Blindpay API execute payout fetch error or parsing error",
      error
    );
  }

  console.log(responseBody);
  if (!response.ok) {
    console.error("Response not OK:", responseBody);
    throw new ExecutePayoutError(
      ExecutePayoutErrorType.INTERNAL_ERROR,
      500,
      "Blindpay execute payout response not OK",
      responseBody
    );
  }

  return responseBody;
};

module.exports = {
  executePayout,
};
