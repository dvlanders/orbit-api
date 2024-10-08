const { getBankAccountInfo } = require("../../../blindpay/getBankAccountInfo");

const fetchBlindpayAccount = async (type, profileId, accountId) => {
  return await getBankAccountInfo(accountId, type);
};

module.exports = fetchBlindpayAccount;
