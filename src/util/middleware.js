const { rs, responseCode } = require("./index");
const { verifyToken } = require("../util/helper/verifyToken");
const supabase = require('./supabaseClient');
const { verifyUser } = require("./helper/verifyUser");
const { isUUID } = require("./common/fieldsValidation");
const { verifyApiKey } = require("./helper/verifyApiKey");
const SECRET = process.env.ZUPLO_SECRET
// /**
//  * @description Middleware to protect routes by verifying JWT token.
//  * @param {Object} req - Express request object.
//  * @param {Object} res - Express response object.
//  * @param {Function} next - Express next function.
//  * @returns
//  */
exports.authorize = async (req, res, next) => {
	try {
		const { userId, apiKeyId } = req.query
		// check api key provider secret
		const token = req.headers['zuplo-secret'];
		if (!token) return res.status(401).json({error: "Not authorized"});
		if (token !== SECRET) return res.status(401).json({error: "Not authorized"});
		// check api key id
		if (!apiKeyId) return res.status(401).json({error: "Not authorized"});
		// get keyInfo
		const keyInfo = await verifyApiKey(apiKeyId)
		if (!keyInfo) return res.status(401).json({error: "Invalid api key"});
		// check userId
		if (userId && (!isUUID(userId) || !(await verifyUser(userId, keyInfo.profile_id)))) return res.status(401).json({error: "Not authorized"});	

		
		req.query.profileId = keyInfo.profile_id
		next();
	} catch (err) {
		console.error(err)
		return res.status(500).json({error : "Unexpected error happened"});
	}
};
