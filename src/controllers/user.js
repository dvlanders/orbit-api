const { v4: uuidv4 } = require("uuid");
const client = require("../config/db.conf");
const validateSchema = require("../util/ValidatorSchema/index");
const valid = require("../util/Validator");
const Ajv = require("ajv");
const ajv = new Ajv();
const User = require("../models/user");
const speakeasy = require("speakeasy");
const registration = require("./index");
const { sendEmail, common } = require("../util/helper");

const { responseCode, rs } = require("../util");
const { success } = require("../util/Constants");

const resetPassword = process.env.RESET_PASSWORD;

// API is USER SIGNUP in HIFI BRIDEG

exports.signUp = async (req, res) => {
  try {
    let generate;
    const { fullName, email, businessName, phoneNumber } = req.body;
    if (email && phoneNumber) {
      // Schema Validations
      let validation = valid.validateObject(
        { email, phoneNumber },
        validateSchema.userSchema.signup
      );
      if (!validation[0])
        return res
          .status(responseCode.badRequest)
          .json(rs.errorResponse(ajv.errorsText(validation[1].errors)));

      let validatePhoneNumber = /^[0-9]*$/.test(phoneNumber); // Phone Number Validation for Numeric String
      if (validatePhoneNumber == false) {
        return res
          .status(responseCode.badRequest)
          .json(rs.incorrectDetails("PLEASE PROVIDE VALID PHONE NUMBER"));
      }
      const count = await User.count({ where: { email } });
      if (count > 0)
        return res.status(responseCode.conflict).json(rs.conflict("USER"));

      req.body.id = uuidv4();
      const password = "123456";
      let link = "https://forms.gle/62ebRR5EicyW2iVg6";
      let mailDetails = {
        from: "kaushiki.mobilefirst@gmail.com",
        to: email,
        subject: "Test mail",
        text: `Please fill up the google form, \n ${link}`,
      };
      generate = await sendEmail.generateEmail(mailDetails); //Generate Email

      if (generate.messageId) {
        let cipherText = common.encryptText(password);
        req.body.password = cipherText;

        let user = await User.create(req.body);
        if (user)
          return res
            .status(responseCode.success)
            .json(
              rs.successResponse(
                "Account registered, please check your email for further process",
                user
              )
            );
      } else
        return res
          .status(responseCode.badRequest)
          .json(rs.incorrectDetails("PLEASE ENTER VALID EMAIL", {}));
    } else {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER THE EMAIL AND PASSWORD", {}));
    }
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

// API is for USER SIGN IN for HIFI BRIDGE

exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email && password) {
      let validation = valid.validateObject(
        { email, password },
        validateSchema.userSchema.signin
      );
      if (!validation[0])
        return res
          .status(400)
          .json({ error: `${ajv.errorsText(validation[1].errors)}` });
      let getUser = await User.findAll({ where: { email: email } });
      if (getUser.length > 0) {
        let decryptText = common.decryptText(getUser[0].password);
        if (decryptText !== password)
          return res
            .status(responseCode.unauthenticated)
            .json(rs.incorrectPassword());

        if (!getUser[0].isVerified) {
          let temp_secret = speakeasy.generateSecret(); // Generate Secret Key

          let addKey = await User.update(
            { secretKey: temp_secret.base32 },
            { where: { email: email } }
          );
          if (addKey) {
            return res.status(responseCode.success).json(
              rs.successResponse("USER SIGNED IN", {
                data: {
                  userId: getUser[0].id,
                  secret: temp_secret.base32,
                  qr_code: temp_secret.otpauth_url,
                },
              })
            );
          }
        } else
          return res.status(responseCode.success).json(
            rs.successResponse("USER RETRIEVED", {
              userId: getUser[0].id,
              isVerified: true,
            })
          );
      } else
        return res
          .status(responseCode.badRequest)
          .json(rs.incorrectDetails("PLEASE ENTER VALID EMAIL", {}));
    } else if (email) {
      let getuser = await User.findAll({ where: { email: email } });

      if (getuser.length > 0) {
        if (!getuser[0].isVerified) {
          let temp_secret = speakeasy.generateSecret(); // Generating Secret Key

          let addKey = await User.update(
            { secretKey: temp_secret.base32 },
            { where: { email: email } }
          );
          if (addKey) {
            return res.status(responseCode.success).json(
              rs.successResponse("USER SIGNED IN", {
                data: {
                  userId: getuser[0].id,
                  secret: temp_secret.base32,
                  qr_code: temp_secret.otpauth_url,
                },
              })
            );
          }
        } else
          return res.status(responseCode.success).json(
            rs.successResponse("USER SIGNED IN", {
              data: { userId: getuser[0].id, isVerified: true },
            })
          );
      } else
        return res
          .status(responseCode.badRequest)
          .json(rs.incorrectDetails("PLEASE ENTER VALID EMAIL", {}));
    } else {
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER VALID EMAIL AND PASSWORD", {}));
    }
  } catch (error) {
    return res
      .status(responseCode.notFound)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

// API is for VERIFY TOTP in HIFI BRIDGE

exports.verifyTOTP = async (req, res) => {
  try {
    const { token } = req.body; // Here token is TOTP from Authenticator APP
    const { userId } = req.params;
    if (!token || !userId) {
      res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE ENTER VALID TOKEN OR USERID", {}));
    }
    let key = await User.findOne({ where: { id: userId } });
    let secret = key?.secretKey;
    if (secret) {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token,
      }); // Verify TOTP
      if (key.isVerified == false) {
        await User.update({ isVerified: true }, { where: { userId: userId } });
      }

      if (verified)
        res
          .status(responseCode.success)
          .json(rs.successResponse("USER VERIFIED", { verified: true }));
      else
        res
          .status(responseCode.badRequest)
          .json(rs.incorrectDetails("USER NOT VERIFIED", { verified: false }));
    } else {
      res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("User QRCODE NOT GENERATED", {}));
    }
  } catch (err) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(err?.message.toString()));
  }
};

// API is for FORGOT PASSWORD in HIFI BRIDGE

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    let getUser = await User.findAll({ where: { email: email } });
    if (getUser.length == 0)
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("PLEASE PROVIDE VALID EMAIL", {}));
    let mailDetails = {
      from: "kaushiki.mobilefirst@gmail.com",
      to: email,
      subject: "Test mail",
      text: `Please click on the link to reset the password ${resetPassword}`,
    };
    generate = await sendEmail.generateEmail(mailDetails); // Generate Email
    if (generate.messageId) {
      return res.status(responseCode.success).json(
        rs.successResponse("PLEASE CHECK EMAIL TO RESET PASSWORD", {
          id: getUser[0].id,
          email: getUser[0].email,
        })
      );
    } else
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("MESSAGE NOT SENT", {}));
  } catch (error) {
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

// API is for RESET PASSWORD for HIFI BRIDGE

exports.resetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const { userId } = req.params;
    let getUsers = await User.findAll({ where: { id: userId } });
    if (getUsers.length > 0) {
      if (newPassword && confirmPassword) {
        if (newPassword !== confirmPassword) {
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
        req.body.confirmPassword = cipherText;
        let updatePassword = await User.update(
          { password: req.body.confirmPassword },
          { where: { id: userId } }
        );
        if (updatePassword.length > 0) {
          return res.status(responseCode.success).json(
            rs.successResponse("PASSWORD UPDATED SUCCESSFULLY", {
              id: getUsers[0].id,
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
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};

// API is for CHANGE PASSWORD for HIFI BRIDGE

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const { userId } = req.params;
    let getUser = await User.findAll({ where: { id: userId } });
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
        req.body.confirmPassword = cipherText;
        let updatePassword = await User.update(
          { password: req.body.confirmPassword },
          { where: { id: userId } }
        );
        if (updatePassword.length > 0) {
          return res.status(responseCode.success).json(
            rs.successResponse("PASSWORD UPDATED SUCCESSFULLY", {
              id: getUser[0].id,
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
    return res
      .status(responseCode.serverError)
      .json(rs.errorResponse(error?.message.toString()));
  }
};
