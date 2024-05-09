const jwt = require('jsonwebtoken');

/**
 * @description Verifies a JSON Web Token (JWT) using the specified secret key from the environment. It returns a promise that resolves with the decoded token if verification is successful, or rejects with an error if verification fails.
 * @param {string} token - The JWT to be verified.
 * @returns {Promise<Object>} A promise that resolves with the decoded token object or rejects with an error.
 */
exports.verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.SUPABASE_AUTH_JWT_SECRET, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};
