const forge = require("node-forge")

exports.generateCypherText = () => {
    const entitySecret = forge.util.hexToBytes(process.env.CIRCLE_WALLET_ENTITY_SECRET)
    const publicKey = forge.pki.publicKeyFromPem(process.env.CIRCLE_WALLET_PUBLIC_KEY.replace(/\\n/g, '\n'))
    const encryptedData = publicKey.encrypt(entitySecret, 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: {
            md: forge.md.sha256.create(),
        },
    })

    return forge.util.encode64(encryptedData)
}