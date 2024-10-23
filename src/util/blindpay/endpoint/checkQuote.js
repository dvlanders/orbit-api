const { CreateQuoteErrorType, CreateQuoteError } = require("../errors");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const checkQuote = async (sourceCurrency, destinationCurrency, requestAmount = 100, coverFees = false) => {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.BLINDPAY_API_KEY}`,
    "Content-Type": "application/json",
  };

  const quoteRequestBody = {
    source_currency: sourceCurrency,
    destination_currency: destinationCurrency,
    request_amount: requestAmount,
    cover_fees: coverFees,
    currency_type: "sender"
  };

  const url = `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/quotes/check`;
  let response, responseBody;
  try {
    response = await fetchWithLogging(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(quoteRequestBody),
    }, "BLINDPAY");
    responseBody = await response.json();
  } catch (error) {
    console.error("Blindpay API check quote fetch error or parsing error:", error);
    throw new CreateQuoteError(
      CreateQuoteErrorType.INTERNAL_ERROR,
      500,
      "Blindpay API check quote fetch error or parsing error",
      responseBody
    );
  }

  // console.log(responseBody);
  if (!response.ok) {
    console.error("Response not OK:", responseBody);
    throw new CreateQuoteError(
      CreateQuoteErrorType.INTERNAL_ERROR,
      500,
      "Blindpay check quote response not OK",
      responseBody
    );
  }

  return responseBody;
};

module.exports = {
  checkQuote,
};
