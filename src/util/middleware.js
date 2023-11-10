// JSON Web Token, is an open standard used to share security information between two parties — a client and a server.
const jwt = require("jsonwebtoken");
const { rs, responseCode } = require("./index");
const { common } = require("../util/helper");
const User = require("../models/userAuth");

/* A middleware function that will be called before any other route handler. */
exports.authorizeUser = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    if (user_id === null || !user_id) {
      common.eventBridge("USER UNAUTHORIZED", responseCode.serverError);
      return res.status(responseCode.unauthorized).json(rs.authErr());
    }

    const userDetails = await User.get(user_id);

    if (userDetails == undefined) {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }

    if (!userDetails?.isVerified || !userDetails?.isSfoxVerified) {
      let message = "";
      if (!userDetails?.isVerified) message = "PLEASE VERIFY THE USER";
      else if (!userDetails?.isSfoxVerified)
        message = "USER NOT REGISTRATION PROCESS INCOMPLETE";
      return res
        .status(responseCode.unauthorized)
        .json(rs.response(responseCode.unauthorized, message, {}));
    }

    req.user = {
      id: userDetails?.user_id,
      phoneNumber: userDetails?.phoneNumber,
      userToken: userDetails?.userToken,
      logoUrl: userDetails?.logoUrl,
      businessName: userDetails?.businessName,
      email: userDetails?.email,
      fullName: userDetails?.fullName,
      sfox_id: userDetails?.sfox_id,
      secretkey: userDetails?.secretkey,
    };

    next();
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err.toString()));
  }
};
