const algorithm = 'aes-256-gcm'; // AES algorithm
const crypto = require('crypto');

const symmetricEncryption = (key, iv, toEncrypt) => {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(toEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag(); // Get the authentication tag

    return {
        iv: iv.toString('hex'),
        encrypted: encrypted,
        tag: tag.toString('hex'),
        algorithm: algorithm
    };
}

module.exports = {
    symmetricEncryption
}