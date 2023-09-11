/* This is a JavaScript library that provides a consistent API for multiple different cryptographic
algorithms. */
const CryptoTS = require("crypto-ts");

/* This is a function that takes a string and encrypts it using the `CryptoTS` library. */
exports.encryptText = (text) => {
  return CryptoTS.AES.encrypt(text, process.env.SECRET_KEY).toString();
};

/* A function that takes a string and decrypts it using the `CryptoTS` library. */
exports.decryptText = (cipherText) => {
  const bytes = CryptoTS.AES.decrypt(cipherText, process.env.SECRET_KEY);
  return bytes.toString(CryptoTS.enc.Utf8);
};

/* A function to filter data from the output of find sequlize queries */
exports.getFindData = (data) =>{
  let arr = [];
  data.map((e,i) => arr.push(e.dataValues));
  return arr
};

/* Validate the request data */
const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true });

exports.validateObject =  function (object, schema) {
    const validate = ajv.compile(schema);
    const valid = validate(object);
    return [valid, validate];
}