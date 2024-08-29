const { CreateQuoteErrorType, CreateQuoteError } = require("../errors");

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
    cover_fees: coverFees
  };

  const url = `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/quotes/check`;
  let response, responseBody;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(quoteRequestBody),
    });
    responseBody = await response.json();
  } catch (error) {
    throw new CreateQuoteError(
      CreateQuoteErrorType.INTERNAL_ERROR,
      500,
      "Blindpay API check quote fetch error or parsing error",
      responseBody
    );
  }

  console.log(responseBody);
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
