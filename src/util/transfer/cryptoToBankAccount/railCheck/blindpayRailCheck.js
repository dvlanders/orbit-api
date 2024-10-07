const { getBankAccountInfoByGlobalId } = require("../../../blindpay/bankAccountService");

const blindpayRailCheck = async (globalAccountId, type) => {

  const blindpayAccountData = await getBankAccountInfoByGlobalId(globalAccountId, type);
  if (!blindpayAccountData || !blindpayAccountData.blindpay_account_id)
    return { isExternalAccountExist: false, blindpayAccountId: null, destinationUserId: null, accountId: null };

  return {
    isExternalAccountExist: true,
    blindpayAccountId: blindpayAccountData.blindpay_account_id,
    destinationUserId: blindpayAccountData.user_id,
    accountId: blindpayAccountData.id,
  };
};

module.exports = blindpayRailCheck;
