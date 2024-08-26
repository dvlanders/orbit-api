const crypto = require("crypto");
const createLog = require("../../logger/supabaseLogger");
const PUBLIC_KEY = process.env.BRIDGE_WEBHOOK_PUBLIC_KEY;

const verifySignature = (timestamp, body, signature) => {
  const hash = crypto.createHash("SHA256");
  hash.update(timestamp + "." + body);

  const verifier = crypto.createVerify("SHA256");
  verifier.update(hash.digest());
  verifier.end();

  return verifier.verify(PUBLIC_KEY, Buffer.from(signature, "base64"));
};

const signatureVerification = async (req, res, next) => {
  try {
    const signatureHeader = req.headers["x-webhook-signature"];
    if (!signatureHeader) {
      console.log("No signature");
      return res.status(400).json({ message: "Malformed signature header" });
    }
    const [, timestamp, signature] =
      signatureHeader.match(/^t=(\d+),v0=(.*)$/) || [];
    if (!timestamp || !signature) {
      console.log("Malformed signature header");
      return res.status(400).json({ message: "Malformed signature header" });
    }

    if (
      new Date(parseInt(timestamp, 10)) < new Date(Date.now() - 10 * 60 * 1000)
    ) {
      console.log("Timestamp is too old");
      return res.status(400).json({ message: "Invalid signature!" });
    }

    if (!verifySignature(timestamp, req.body, signature)) {
      console.log("Invalid signature");
      return res.status(400).json({ message: "Invalid signature!" });
    }

    // Convert the raw body buffer to a string
    const rawBodyString = req.body.toString("utf8");
    // Parse the string as JSON
    const parsedBody = JSON.parse(rawBodyString);
    req.body = parsedBody;
    next();
  } catch (error) {
    await createLog("webhook/bridgeWebhook", null, error.message, error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  signatureVerification,
};
