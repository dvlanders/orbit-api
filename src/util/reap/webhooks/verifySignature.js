const crypto = require('crypto');

const publicKey = process.env.REAP_WEBHOOK_PUBLIC_KEY ? process.env.REAP_WEBHOOK_PUBLIC_KEY.replace(/\\n/g, '\n') : null

exports.verifyReapSignature = (req, res, next) => {
    const message = JSON.stringify(req.body);
    const signature = req.headers['reap-signature'];

    if (!signature) {
        return res.status(401).json({ message: 'Missing signature header' });
    }
  
    const verifier = crypto.createVerify('RSA-SHA512');
    verifier.write(message);
    verifier.end();
    const isVerified = verifier.verify(publicKey, signature, 'base64');

    if (!isVerified) {
        console.log('Invalid signature');
        return res.status(401).json({ message: 'Invalid signature' });
    }

    next();
}