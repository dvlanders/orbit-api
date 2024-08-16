const crypto = require('crypto');


function generateKeyPair(modulusLength = 2048) {
    const passphrase = process.env.WEBHOOK_ENCRYPTION_SECRET
    if (!passphrase) throw new Error("No passphrase found")
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: modulusLength,
        publicKeyEncoding: {
          type: 'spki',  // Recommended for RSA keys
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',  // Recommended for RSA keys
          format: 'pem',
          cipher: 'aes-256-cbc',
            passphrase: passphrase
        }
      }, (err, publicKey, privateKey) => {
        if (err) {
          return reject(err);
        }
        resolve({ publicKey, privateKey });
      });
    });
  }

module.exports = generateKeyPair