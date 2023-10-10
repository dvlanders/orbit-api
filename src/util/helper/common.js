/* This is a JavaScript library that provides a consistent API for multiple different cryptographic
algorithms. */
const CryptoTS = require("crypto-ts");

exports.generateRandomNumberWithDigits = (digits) => {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomNumber.toString();
};

/* This is a function that takes a string and encrypts it using the `CryptoTS` library. */
exports.encryptText = (text) => {
  return CryptoTS.AES.encrypt(text, process.env.PASSWORD_SECRET_KEY).toString();
};

/* A function that takes a string and decrypts it using the `CryptoTS` library. */
exports.decryptText = (cipherText) => {
  const bytes = CryptoTS.AES.decrypt(
    cipherText,
    process.env.PASSWORD_SECRET_KEY
  );
  return bytes.toString(CryptoTS.enc.Utf8);
};
