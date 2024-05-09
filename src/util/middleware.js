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
			return res.status(responseCode.unauthorized).json({ error: userDetailsError.message ?? "We could not find user" });
		};

		if (userDetails.deactivated_at) {
			return res.status(responseCode.ok).json({ message: "User has been deactivated" });
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
