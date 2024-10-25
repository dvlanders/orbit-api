const { CreateQuoteErrorType, CreateQuoteError } = require("../errors");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const createQuote = async (bankAccountId, quoteAmount, network, token) => {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.BLINDPAY_API_KEY}`,
    "Content-Type": "application/json",
  };

  const quoteRequestBody = {
    bank_account_id: bankAccountId,
    currency_type: "sender",
    cover_fees: false,
    request_amount: quoteAmount,
    network: network,
    token: token,
  };

  const url = `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/quotes`;
  let response, responseBody;
  try {
    response = await fetchWithLogging(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(quoteRequestBody),
    }, "BLINDPAY");
    responseBody = await response.json();
  } catch (error) {
    throw new CreateQuoteError(
      CreateQuoteErrorType.INTERNAL_ERROR,
      500,
      "Blindpay API get quote fetch error or parsing error",
      responseBody
    );
  }

  // console.log(responseBody);
  if (!response.ok) {
    console.error("Response not OK:", responseBody);
    throw new CreateQuoteError(
      CreateQuoteErrorType.INTERNAL_ERROR,
      500,
      "Blindpay get quote response not OK",
      responseBody
    );
  }

  return responseBody;
};

module.exports = {
  createQuote,
};
