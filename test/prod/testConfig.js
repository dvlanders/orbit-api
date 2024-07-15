//Create User parameters
const userInfo = {
  FIRST_NAME: process.env.USER_FIRST_NAME_TEST,
  LAST_NAME: process.env.USER_LAST_NAME_TEST,
  EMAIL: process.env.USER_EMAIL_TEST,
  PHONE: process.env.USER_PHONE_TEST,
  DOB: process.env.USER_DOB_TEST,
  TAX: process.env.USER_TAX_TEST,
  GOV_ID_COUNTRY: process.env.USER_GOV_ID_COUNTRY_TEST,
  GOV_ID_FRONT: process.env.USER_GOV_ID_FRONT_TEST,
  GOV_ID_BACK: process.env.USER_GOV_ID_BACK_TEST,
  COUNTRY: process.env.USER_COUNTRY_TEST,
  ADDRESS: process.env.USER_ADDRESS_LINE_1_TEST,
  CITY: process.env.USER_CITY_TEST,
  POSTAL: process.env.USER_POSTAL_CODE_TEST,
  STATE: process.env.USER_STATE_PROVINCE_TEST,
  USER_ID: process.env.USER_ID_TEST,
};

// USD Offramp Circle wire bank account details
const usdOfframpCircleWireBankDetails = {
  ACCOUNT_NUMBER: process.env.CC_ACCOUNT_NO_TEST,
  ROUTING_NUMBER: process.env.CC_ROUTING_NO_TEST,
  ACCOUNT_HOLDER_NAME: process.env.CC_ACCOUNT_HOLDER_NAME_TEST,
  ACCOUNT_HOLDER_CITY: process.env.CC_ACCOUNT_HOLDER_CITY_TEST,
  ACCOUNT_HOLDER_COUNTRY: process.env.CC_ACCOUNT_HOLDER_COUNTRY_TEST,
  ACCOUNT_HOLDER_STREET_LINE1: process.env.CC_ACCOUNT_HOLDER_STREET_TEST,
  ACCOUNT_HOLDER_POSTAL_CODE: process.env.CC_ACCOUNT_HOLDER_POSTAL_TEST,
  ACCOUNT_HOLDER_STATE_PROVINCE_REGION:
    process.env.CC_ACCOUNT_HOLDER_REGION_TEST,
  BANK_COUNTRY: process.env.CC_ACCOUNT_BANK_COUNTRY_TEST,
};

// EUR Offramp bank account details
const eurOfframpBankDetails = {
  BANK_NAME: process.env.EUR_OFFRAMP_BANK_NAME_TEST,
  ACCOUNT_OWNER_NAME: process.env.EUR_OFFRAMP_ACCOUNT_OWNER_NAME_TEST,
  IBAN_ACCOUNT_NUMBER: process.env.EUR_OFFRAMP_IBAN_ACCOUNT_NO_TEST,
  IBAN_COUNTRY_CODE: process.env.EUR_OFFRAMP_IBAN_COUNTRY_CODE_TEST,
  BIC: process.env.EUR_OFFRAMP_BIC_TEST,
  FIRST_NAME: process.env.EUR_OFFRAMP_FIRST_NAME_TEST,
  LAST_NAME: process.env.EUR_OFFRAMP_LAST_NAME_TEST,
};

// USD Offramp bank details
const usdOfframpBankDetails = {
  BANK_NAME: process.env.USD_OFFRAMP_BANK_NAME_TEST,
  ACCOUNT_OWNER_NAME: process.env.USD_OFFRAMP_ACCOUNT_OWNER_NAME_TEST,
  ACCOUNT_NUMBER: process.env.USD_OFFRAMP_ACCOUNT_NO_TEST,
  ROUTING_NUMBER: process.env.USD_OFFRAMP_ROUTING_NO_TEST,
  STREET_LINE_1: process.env.USD_OFFRAMP_STREET_LINE_1_TEST,
  CITY: process.env.USD_OFFRAMP_CITY_TEST,
  STATE: process.env.USD_OFFRAMP_STATE_TEST,
  POSTAL_CODE: process.env.USD_OFFRAMP_POSTAL_TEST,
  COUNTRY: process.env.USD_OFFRAMP_COUNTRY_TEST,
};

// USD Onramp bank details
const usdOnrampPlaidBankDetails = {
  ACCOUNT_TYPE: process.env.USD_ONRAMP_ACCOUNT_TYPE_TEST,
  BANK_NAME: process.env.USD_ONRAMP_BANK_NAME_TEST,
  PLAID_TOKEN: process.env.PLAID_PROCESSOR_TOKEN_TEST,
  // Add other USD onramp bank details here
};

const getAccountParams = {
  US_ONRAMP_ACCOUNT_ID: process.env.US_ONRAMP_AID_TEST,
  US_ONRAMP_USER_ID: process.env.US_ONRAMP_UID_TEST,
  EU_OFFRAMP_ACCOUNT_ID: process.env.EU_OFFRAMP_AID_TEST,
  EU_OFFRAMP_USER_ID: process.env.EU_OFFRAMP_UID_TEST,
  US_OFFRAMP_ACCOUNT_ID: process.env.US_OFFRAMP_AID_TEST,
  US_OFFRAMP_USER_ID: process.env.US_OFFRAMP_UID_TEST,
};

const createCryptoToCryptoTransferParams = {
  SENDER_USER_ID: process.env.USER_ID_TEST,
  RECIPIENT_USER_ID: process.env.USER_ID_TEST,
};

const createFiatToCryptoTransferParams = {
  SOURCE_USER_ID: process.env.USER_ID_TEST,
  SOURCE_ACCOUNT_ID: process.env.FIAT_TO_CRYPTO_AID_TEST,
  DESTINATION_USER_ID: process.env.USER_ID_TEST,
};

const transferCryptoFromWalletToBankAccountParams = {
  SOURCE_USER_ID: process.env.USER_ID_TEST,
  DESTINATION_USER_ID: process.env.USER_ID_TEST,
  DESTINATION_ACCOUNT_ID: process.env.CRYPTO_TO_FIAT_AID_TEST,
};

const getCryptoToCryptoTransferParams = {
  RECORD_ID: process.env.CRYPTO_TO_CRYPTO_RECORD_ID_TEST,
};

const getCryptoToFiatTransferParams = {
  RECORD_ID: process.env.CRYPTO_TO_FIAT_RECORD_ID_TEST,
};

const getFiatToCryptoTransferParams = {
  RECORD_ID: process.env.FIAT_TO_CRYPTO_RECORD_ID_TEST,
};

// Auth test parameters
const authTestParams = {
  API_KEY: process.env.API_KEY_TEST,
  ZUPLO_SECRET: process.env.ZUPLO_SECRET,
  // Add other relevant parameters here
};

// Export grouped parameters
module.exports = {
  userInfo,
  usdOfframpCircleWireBankDetails,
  eurOfframpBankDetails,
  usdOfframpBankDetails,
  usdOnrampPlaidBankDetails,
  getAccountParams,
  createCryptoToCryptoTransferParams,
  createFiatToCryptoTransferParams,
  transferCryptoFromWalletToBankAccountParams,
  getCryptoToCryptoTransferParams,
  getCryptoToFiatTransferParams,
  getFiatToCryptoTransferParams,
  authTestParams,
};
