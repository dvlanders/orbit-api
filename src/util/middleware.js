const { rs, responseCode } = require("./index");
const { verifyToken } = require("../util/helper/verifyToken");
const supabase = require('./supabaseClient');

// /**
//  * @description Middleware to protect routes by verifying JWT token.
//  * @param {Object} req - Express request object.
//  * @param {Object} res - Express response object.
//  * @param {Function} next - Express next function.
//  * @returns
//  */
exports.authorizeUser = async (req, res, next) => {
	try {
		const token = req.headers.authorization?.split(" ")[1];
		if (!token) {
			return res.status(responseCode.unauthenticated).json(rs.authErr());
		};

		const user = await verifyToken(token);

		if (!user && !user?.sub) {
			return res.status(responseCode.unauthorized).json({ error: "We could not find user" });
		};

		const { data: userDetails, error: userDetailsError } = await supabase
			.from('profiles')
			.select('*')
			.eq('user_id', user.sub)
			.single();

		if (!userDetails && userDetailsError) {
			await supabase.from('logs').insert({
				log: 'could not find user',
				merchant_id: userDetails.merchant_id,
				endpoint: 'auhtorizeUser middleware',
			});
			return res.status(responseCode.unauthorized).json({ error: userDetailsError.message ?? "We could not find user" });
		};

		if (userDetails.deactivated_at) {
			await supabase.from('logs').insert({
				log: 'User has been deactivated',
				merchant_id: userDetails.merchant_id,
				endpoint: 'auhtorizeUser middleware',
			});
			return res.status(responseCode.ok).json({ message: "User has been deactivated" });
		}

		if (!userDetails.merchant_id) {
			await supabase.from('logs').insert({
				log: 'Merchant id for this user could not be found',
				merchant_id: userDetails.merchant_id,
				endpoint: 'auhtorizeUser middleware',
			});
			return res.status(responseCode.ok).json({ message: "Merchant id for this user could not be found" });
		}
		if (req.body.merchantId && req.body.merchantId != userDetails.merchant_id) {
			await supabase.from('logs').insert({
				log: 'User merchant id in db does not match the merchantId passed in the request',
				merchant_id: userDetails.merchant_id,
				endpoint: 'auhtorizeUser middleware',
			});
			return res.status(responseCode.unauthorized).json({ message: "User's merchant id in db does not match the merchantId passed in the request" });
		}
		if (req.query.merchantId && req.query.merchantId != userDetails.merchant_id) {
			return res.status(responseCode.unauthorized).json({ message: "We could not find user" });
		}


		req.user = {
			id: userDetails?.user_id,
			fullName: userDetails?.fullName,
			email: userDetails?.email,
			phoneNumber: userDetails?.phoneNumber,
			merchant_id: userDetails?.merchant_id,
			created_at: userDetails?.created_at,
		};

		next();
	} catch (err) {
		return res
			.status(responseCode.serverError)
			.json(rs.errorResponse(err.toString()));
	}
};
