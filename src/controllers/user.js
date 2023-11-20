const { v4: uuidv4 } = require("uuid");
const validateSchema = require("../util/ValidatorSchema/index");
const valid = require("../util/Validator");
const Ajv = require("ajv");
const ajv = new Ajv();
const speakeasy = require("speakeasy");
const { sendEmail, common } = require("../util/helper");
const { responseCode, rs, messages } = require("../util");
const User = require("./../models/userAuth");

/**
 * @description API is USER SIGNUP in HIFI BRIDGE
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.signUp = async (req, res) => {
  try {
    let generate;
    const { fullName, email, businessName, phoneNumber, timeZone } = req.body;

    if (!email && !phoneNumber) {
      common.eventBridge(
        "PLEASE ENTER THE EMAIL AND PASSWORD",
        responseCode.badRequest
      );
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER THE EMAIL AND PASSWORD", {}));
    }

    // Schema Validations
    let validation = valid.validateObject(
      {
        email,
        phoneNumber,
      },
      validateSchema.userSchema.signup
    );
    if (!validation[0]) {
      common.eventBridge(
        ajv.errorsText(validation[1].errors),
        responseCode.badRequest
      );
      return res
        .status(responseCode.badRequest)
        .json(rs.errorResponse(ajv.errorsText(validation[1].errors)));
    }

    let validatePhoneNumber = /^[0-9]*$/.test(phoneNumber); // Phone Number Validation for Numeric String
    if (validatePhoneNumber == false) {
      common.eventBridge(
        "PLEASE PROVIDE VALID PHONE NUMBER",
        responseCode.badRequest
      );
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE PROVIDE VALID PHONE NUMBER"));
    }
    const userDetails = await User.scan().where("email").eq(email).exec();

    if (userDetails?.count > 0) {
      common.eventBridge("USER ALREADY EXIST", responseCode.conflict);
      return res.status(responseCode.conflict).json(rs.conflict("USER"));
    }

    const password = process.env.REGISTER_PASSWORD;

    let otp = common.generateRandomNumberWithDigits(6);

    let mailDetails = {
      from: `${process.env.FROM_EMAIL}`,
      to: email,
      subject: "OTP - VERIFICATION CODE",
      text: `Please fill up the google form, \n ${process.env.REGISTER_FORM_LINK}`,
      fileName: "RegisterOTP.ejs",
      otp: otp,
    };

    generate = await sendEmail.generateEmail(mailDetails, fullName); //Generate Email

    if (generate.messageId) {
      let cipherText = common.encryptText(password);
      req.body.password = cipherText;

      const myUser = new User({
        user_id: uuidv4(),
        email: email,
        phoneNumber: phoneNumber,
        fullName: fullName,
        businessName: businessName,
        password: cipherText,
        userToken: "",
        secretkey: "",
        isVerified: false,
        timeZone: timeZone,
        otp: otp,
        otpTimestamp: Date.now(),
      });
      let user = await myUser.save();

      if (user) {
        common.eventBridge(
          "OTP SENT TO YOU REGISTERED EMAIL",
          responseCode.success
        );
        return res.status(responseCode.success).json(
          rs.successResponse("OTP SENT TO YOUR REGISTERED EMAIL", {
            email: user["email"],
          })
        );
      }
    } else {
      common.eventBridge("PLEASE ENTER VALID EMAIL", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER VALID EMAIL", {}));
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { otp, email } = req.body;

    console.log(email);

    if (!otp || !email) {
      common.eventBridge("PLEASE ENTER  OTP OR EMAIL", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER OTP OR EMAIL", {}));
    }

    let userDetails = await User.scan().where("email").eq(email).exec();

    if (userDetails?.count == 0) {
      return res.status(responseCode.unauthorized).json(rs.authErr({}));
    }

    if (userDetails[0].isOTPVerified == true)
      return res
        .status(responseCode.success)
        .json(rs.successResponse("USER ALREADY VERIFIED", {}));

    const storedOTP = userDetails[0].otp;
    const storedTimestamp = userDetails[0].otpTimestamp;
    const validityPeriod = 15 * 60 * 1000; // 15 minutes in milliseconds

    console.log(storedOTP);
    console.log(storedOTP === otp);
    console.log(otp);
    console.log(storedOTP && storedOTP === otp);

    if (storedOTP && storedOTP === otp) {
      const isExpired =
        storedTimestamp && Date.now() - storedTimestamp < validityPeriod;
      console.log(storedTimestamp && Date.now() - storedTimestamp);
      console.log(validityPeriod);

      console.log(isExpired);

      if (isExpired) {
        // Update user's verification status or perform any other necessary actions

        let userData = await User.update(
          {
            user_id: userDetails[0].user_id,
          },
          {
            isOTPVerified: true,
          }
        );

        //  Register Email trigger

        console.log(userData);

        delete userData.password;

        return res
          .status(responseCode.success)
          .json(rs.successResponse("USER VERIFIED", {}));
      } else {
        common.eventBridge("OTP EXPIRED", responseCode.badRequest);
        return res.status(responseCode.badRequest).json(
          rs.incorrectDetails("OTP EXPIRED", {
            isOTPVerified: false,
          })
        );
      }
    } else {
      common.eventBridge(
        "PLEASE ENTER THE CORRECT OTP",
        responseCode.badRequest
      );
      return res.status(responseCode.badRequest).json(
        rs.incorrectDetails("PLEASE ENTER THE CORRECT OTP", {
          isOTPVerified: false,
        })
      );
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.badRequest);
    return res
      .status(responseCode.badRequest)
      .json(rs.incorrectDetails(error?.message.toString(), {}));
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      common.eventBridge("PLEASE ENTER EMAIL", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER EMAIL", {}));
    }

    const userDetails = await User.scan().where("email").eq(email).exec();

    if (userDetails?.count === 0) {
      common.eventBridge("USER NOT FOUND", responseCode.notFound);
      return res
        .status(responseCode.notFound)
        .json(rs.notFound("USER NOT FOUND"));
    }

    if (userDetails[0].isOTPVerified === true)
      return res
        .status(responseCode.success)
        .json(rs.successResponse("USER ALREADY VERIFIED"));

    const newOTP = common.generateRandomNumberWithDigits(6);
    const newOtpTimestamp = Date.now();

    let mailDetails = {
      from: `${process.env.FROM_EMAIL}`,
      to: email,
      subject: "OTP - VERIFICATION CODE",
      text: `Your new OTP is: ${newOTP}`,
      fileName: "RegisterOTP.ejs", // Update with the actual file name
      otp: newOTP,
    };

    const generate = await sendEmail.generateEmail(
      mailDetails,
      userDetails[0].fullName
    );

    if (generate.messageId) {
      // Update user's OTP and OTP timestamp
      await User.update(
        {
          user_id: userDetails[0].user_id,
        },
        {
          otp: newOTP,
          otpTimestamp: newOtpTimestamp,
        }
      );

      common.eventBridge("OTP RESENT", responseCode.success);
      return res
        .status(responseCode.success)
        .json(rs.successResponse("OTP RESENT"));
    } else {
      common.eventBridge("FAILED TO RESEND OTP", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("FAILED TO RESEND OTP"));
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

/**
 * @description API is for USER SIGN IN for HIFI BRIDGE
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email && password) {
      let validation = valid.validateObject(
        {
          email,
          password,
        },
        validateSchema.userSchema.signin
      );
      if (!validation[0]) {
        common.eventBridge(
          ajv.errorsText(validation[1].errors),
          responseCode.badRequest
        );
        return res.status(responseCode.badRequest).json({
          error: `${ajv.errorsText(validation[1].errors)}`,
        });
      }

      const getUser = await User.scan().where("email").eq(email).exec();

      if (getUser.count > 0) {
        console.log(getUser);

        if (getUser[0].isOTPVerified == false) {
          let otp = common.generateRandomNumberWithDigits(6);

          let mailDetails = {
            from: `${process.env.FROM_EMAIL}`,
            to: email,
            subject: "OTP - VERIFICATION CODE",
            text: `Please fill up the google form, \n ${process.env.REGISTER_FORM_LINK}`,
            fileName: "RegisterOTP.ejs",
            otp: otp,
          };

          generate = await sendEmail.generateEmail(
            mailDetails,
            getUser[0].fullName
          ); //Generate Email
          await User.update(
            {
              user_id: getUser[0].user_id,
            },
            {
              otp: otp,
            }
          );

          return res.status(responseCode.success).json(
            rs.successResponse("PLEASE VERIFY USER, OTP SENT", {
              isOTPVerified: false,
            })
          );
        }

        let decryptText = common.decryptText(getUser[0].password);
        if (decryptText !== password) {
          common.eventBridge(
            messages.incorrectPassword,
            responseCode.unauthenticated
          );
          return res
            .status(responseCode.unauthenticated)
            .json(rs.incorrectPassword());
        }

        if (getUser[0].isVerified == false) {
          let temp_secret = speakeasy.generateSecret({
            name: email,
          }); // Generate Secret Key

          const otpauth_url = speakeasy.otpauthURL({
            secret: temp_secret.base32,
            label: encodeURIComponent(email), // Ensure the email is URL encoded
            issuer: "HIFI Pay", // Replace with your app's name
          });

          let addKey = await User.update(
            {
              user_id: getUser[0].user_id,
            },
            {
              secretkey: temp_secret.base32,
            }
          );

          if (addKey.secretkey) {
            common.eventBridge(
              "USER SIGNED IN SUCCESSFULLY",
              responseCode.success
            );
            return res.status(responseCode.success).json(
              rs.successResponse("USER SIGNED IN", {
                userId: getUser[0].user_id,
                secret: temp_secret.base32,
                qr_code: otpauth_url,
                businessName: getUser[0].businessName,
                timeZone: getUser[0].timeZone,
              })
            );
          }
        } else {
          common.eventBridge(
            "USER RETRIEVED SUCCESSFULLY",
            responseCode.success
          );
          return res.status(responseCode.success).json(
            rs.successResponse("USER RETRIEVED", {
              userId: getUser[0].user_id,
              isVerified: true,
              secret: getUser[0].secretkey,
              qr_code: `otpauth://totp/${encodeURIComponent(email)}?secret=${
                getUser[0].secretkey
              }&issuer=${encodeURIComponent("HIFI Pay")}`,
              businessName: getUser[0].businessName,
              timeZone: getUser[0].timeZone,
            })
          );
        }
      } else {
        common.eventBridge("PLEASE ENTER VALID EMAIL", responseCode.badRequest);
        return res
          .status(responseCode.badRequest)
          .json(rs.incorrectDetails("PLEASE ENTER VALID EMAIL", {}));
      }
    } else {
      common.eventBridge(
        "PLEASE ENTER VALID EMAIL AND PASSWORD",
        responseCode.badRequest
      );
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER VALID EMAIL AND PASSWORD", {}));
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

/**
 * @description The sign in with google api which only take email as the input
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.signInGoogle = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      common.eventBridge("PLEASE ENTER VALID EMAIL", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE USE VALID EMAIL", {}));
    }

    console.log(email);

    const userDetails = await User.scan().where("email").eq(email).exec();

    console.log(userDetails);

    if (userDetails?.count == 0) {
      common.eventBridge("PLEASE ENTER VALID EMAIL", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE REGISTER YOUR ACCOUNT", {}));
    }
    if (userDetails[0].isOTPVerified == false) {
      let otp = common.generateRandomNumberWithDigits(6);

      let mailDetails = {
        from: `${process.env.FROM_EMAIL}`,
        to: email,
        subject: "OTP - VERIFICATION CODE",
        text: `Please fill up the google form, \n ${process.env.REGISTER_FORM_LINK}`,
        fileName: "RegisterOTP.ejs",
        otp: otp,
      };

      generate = await sendEmail.generateEmail(
        mailDetails,
        userDetails[0].fullName
      ); //Generate Email
      await User.update(
        {
          user_id: userDetails[0].user_id,
        },
        {
          otp: otp,
        }
      );

      return res.status(responseCode.success).json(
        rs.successResponse("PLEASE VERIFY USER, OTP SENT", {
          isOTPVerified: false,
        })
      );
    }

    if (userDetails[0].isVerified == false) {
      let temp_secret = speakeasy.generateSecret({
        name: email,
      }); // Generate Secret Key

      const otpauth_url = speakeasy.otpauthURL({
        secret: temp_secret.base32,
        label: encodeURIComponent(email), // Ensure the email is URL encoded
        issuer: "HIFI Pay", // Replace with your app's name
      });
      let addKey = await User.update(
        {
          user_id: userDetails[0].user_id,
        },
        {
          secretkey: temp_secret.base32,
        }
      );
      if (addKey.secretkey) {
        return res.status(responseCode.success).json(
          rs.successResponse("USER SIGNED IN", {
            userId: userDetails[0].user_id,
            secret: temp_secret.base32,
            qr_code: otpauth_url,
            businessName: userDetails[0].businessName,
            timeZone: userDetails[0].timeZone,
          })
        );
      }
    } else
      return res.status(responseCode.success).json(
        rs.successResponse("USER SIGNED IN", {
          userId: userDetails[0].user_id,
          isVerified: true,
          secret: userDetails[0].secretkey,
          qr_code: `otpauth://totp/${encodeURIComponent(email)}?secret=${
            userDetails[0].secretkey
          }&issuer=${encodeURIComponent("HIFI Pay")}`,
          timeZone: userDetails[0].timeZone,
        })
      );
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

/**
 * @description API is for VERIFY TOTP in HIFI BRIDGE
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.verifyTOTP = async (req, res) => {
  try {
    const { userToken } = req.body; // Here token is TOTP from Authenticator APP
    const { userId } = req.params;
    if (!userToken || !userId) {
      common.eventBridge(
        "PLEASE ENTER VALID TOKEN OR USERID",
        responseCode.badRequest
      );
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER VALID TOKEN OR USERID", {}));
    }
    let userDetails = await User.scan().where("user_id").eq(userId).exec();

    console.log(userDetails.count);

    if (userDetails?.count == 0)
      return res.status(responseCode.unauthorized).json(rs.authErr({}));

    let secret = userDetails[0].secretkey;
    console.log(secret);

    if (secret) {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token: userToken,
      }); // Verify TOTP
      console.log(verified);
      if (userDetails[0].isVerified == false) {
        await User.update(
          {
            user_id: userDetails[0].user_id,
          },
          {
            isVerified: true,
          }
        );
      }
      if (verified)
        return res.status(responseCode.success).json(
          rs.successResponse("USER VERIFIED", {
            verified: true,
          })
        );
      else {
        common.eventBridge("USER NOT VERIFIED", responseCode.badRequest);
        return res.status(responseCode.badRequest).json(
          rs.incorrectDetails("USER NOT VERIFIED", {
            verified: false,
          })
        );
      }
    } else {
      common.eventBridge("USER NOT VERIFIED", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("User QRCODE NOT GENERATED", {}));
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

/**
 * @description API is for FORGOT PASSWORD in HIFI BRIDGE
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const userDetails = await User.scan().where("email").eq(email).exec();

    if (userDetails?.count === 0)
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE PROVIDE VALID EMAIL", {}));

    let mailDetails = {
      from: `${process.env.FROM_EMAIL}`,
      to: email,
      subject: "Reset Password",
      text: `Please click on the link to reset the password ${process.env.FRONTEND_URL}/auth/ResetPassword?userId=${userDetails[0].user_id}`,
      resetLink: `${process.env.FRONTEND_URL}/auth/ResetPassword?userId=${userDetails[0].user_id}`,
      fileName: "ResetPasswordTemplate.ejs",
    };

    generate = await sendEmail.generateEmail(
      mailDetails,
      userDetails[0]?.fullName
    ); // Generate Email
    if (generate.messageId) {
      common.eventBridge(
        "PLEASE CHECK EMAIL TO RESET PASSWORD",
        responseCode.badRequest
      );
      return res.status(responseCode.success).json(
        rs.successResponse("PLEASE CHECK EMAIL TO RESET PASSWORD", {
          userId: userDetails[0].user_id,
          email: userDetails[0].email,
        })
      );
    } else {
      common.eventBridge("MESSAGE NOT SENT", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("MESSAGE NOT SENT", {}));
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

/**
 * @description API is for RESET PASSWORD for HIFI BRIDGE
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const { userId } = req.params;

    const count = await User.scan().exec();
    var getUsers = count.filter(function (item) {
      return item.user_id == userId;
    });

    if (getUsers.length > 0) {
      if (newPassword && confirmPassword) {
        if (newPassword !== confirmPassword) {
          common.eventBridge(
            "CONFIRM PASSWORD AND NEWPASSWORD ARE DIFFERENT",
            responseCode.badRequest
          );
          return res
            .status(responseCode.badRequest)
            .json(
              rs.incorrectDetails(
                "CONFIRM PASSWORD AND NEWPASSWORD ARE DIFFERENT",
                {}
              )
            );
        }
        let cipherText = common.encryptText(confirmPassword);
        let updatePassword = await User.update(
          {
            user_id: getUsers[0].user_id,
          },
          {
            password: cipherText,
          }
        );
        if (updatePassword) {
          return res.status(responseCode.success).json(
            rs.successResponse("PASSWORD UPDATED", {
              userId: getUsers[0].user_id,
            })
          );
        } else {
          return res
            .status(responseCode.badRequest)
            .json(
              rs.dataNotAdded(
                "PASSWORD NOT UPDATED SUCCESSFULLY, PLEASE TRY AGAIN",
                {}
              )
            );
        }
      } else {
        return res
          .status(responseCode.badRequest)
          .json(
            rs.incorrectDetails(
              "PLEASE PROVIDE NEW PASSWORD AND CONFIRM PASSWORD",
              {}
            )
          );
      }
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

/**
 * @description API is for CHANGE PASSWORD for HIFI BRIDGE
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const { userId } = req.params;
    const count = await User.scan().exec();
    var getUser = count.filter(function (item) {
      return item.user_id == userId;
    });

    if (getUser.length > 0 && currentPassword) {
      if (newPassword && confirmPassword) {
        let decryptText = common.decryptText(getUser[0].password);
        if (currentPassword !== decryptText)
          return res
            .status(responseCode.badRequest)
            .json(
              rs.incorrectDetails(
                "PLEASE ENTER YOUR VALID CURRENT PASSWORD",
                {}
              )
            );
        if (newPassword !== confirmPassword)
          return res
            .status(responseCode.badRequest)
            .json(
              rs.incorrectDetails(
                "NEW PASSWORD DOES NOT MATCH WITH CONFIRM PASSWORD",
                {}
              )
            );
        let cipherText = common.encryptText(confirmPassword);
        let updatePassword = await User.update(
          {
            user_id: getUser[0].user_id,
          },
          {
            password: cipherText,
          }
        );
        if (updatePassword) {
          return res.status(responseCode.success).json(
            rs.successResponse("PASSWORD UPDATED", {
              id: getUser[0].user_id,
            })
          );
        } else {
          return res
            .status(responseCode.badRequest)
            .json(rs.dataNotAdded("PASSWORD NOT UPDATED SUCCESSFULLY", {}));
        }
      } else {
        return res
          .status(responseCode.badRequest)
          .json(
            rs.incorrectDetails(
              "PLEASE PROVIDE NEW PASSWORD AND CONFIRM PASSWORD",
              {}
            )
          );
      }
    } else {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectPassword("PLEASE PROVIDE CURRENT PASSWORD", {}));
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};
