const { rs, responseCode } = require("./index");
const { verifyToken } = require("../util/helper/verifyToken");
const supabase = require('./supabaseClient');
const { verifyUser } = require("./helper/verifyUser");
const { isUUID } = require("./common/fieldsValidation");
const { verifyApiKey } = require("./helper/verifyApiKey");
const SECRET = process.env.ZUPLO_SECRET
const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET
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

exports.authorizeSupabase = async(req, res, next) => {
	try{
		const token = req.headers['supabase-webhook-secret'];
		if (token !== SUPABASE_WEBHOOK_SECRET) return res.status(401).json({error: "Not authorized"});
		next()
	}catch (error){
		console.error(err)
		return res.status(500).json({error : "Unexpected error happened"});
	}
}

exports.authorizeDashboard = async(req, res, next) => {
	try{
		// this token will be supabase auth token
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({error: "Not authorized"});
        };

        // get user info (user_id)
        const user = await verifyToken(token);
        if (!user && !user?.sub) {
            return res.status(401).json({ error: "Not authorized" });
        };
        req.query.profileId = user.sub
		next()
	}catch (error){
		console.error(error)
		return res.status(500).json({error : "Unexpected error happened"});
	}
}
