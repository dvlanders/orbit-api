const jwt = require("jsonwebtoken");
const { rs, messages } = require("../util");
const { db } = require("../models");
const Ajv = require('ajv')
const ajv = new Ajv()
const { encryptText, decryptText, getFindData, validateObject } = require("../util/Common");
const { userSchema } = require("../util/ValidatorSchema/index")
var User  = db.user;
/**
 *
 *@name addUser
 * @param {*} req
 * @param {*} res
 * @description Validate if the all the requested data is present then adds the data in the database.
 */
 exports.addUser = async (req, res) => {
   console.log("Add User");
   res.send("Hello")
  };

  exports.signup = async (req, res) => {
    try {
      const { email, password } = req.body;

      let isValid = validateObject({ email, password }, userSchema.signup)
      if (!isValid[0]) return res.send(rs.errorResponse(`Error: ${ajv.errorsText(isValid[1].errors)}`));

      let cipherText = encryptText(password);
      const [user, created] = await User.findOrCreate({
        where: { email },
        defaults: { password: cipherText },
      });
      console.log(user.toJSON());
      console.log(created);
      if(created){
        return res.send(rs.successResponse(messages.userCreated));
      }else{
        return res.send(rs.conflict(messages.user))
      }
    } catch (err) {
      return res.send(rs.errorResponse(err.toString()));
    }
  };

  /**
 *
 * @name signin
 * @param {*} req
 * @param {*} res
 * @description User sign in using email and password. Validate email ID and Password with the database and
 *  then creates a token using jwt.
 */
exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    let isValid = validateObject({ email, password }, userSchema.signin)
    if (!isValid[0]) return res.send(rs.errorResponse(`Error: ${ajv.errorsText(isValid[1].errors)}`));

    let data = await User.findAll({
      limit: 1,
      where: { email },
      order: [ [ 'createdAt', 'DESC' ] ]
      });
    if (data.length > 0) {
      data = getFindData(data);
      console.log(data);
      const originalText = decryptText(data[0].password);
      console.log(originalText);
      if (originalText === password) {
        const token = jwt.sign(data[0], process.env.TOKEN_KEY);
        return res.send(rs.successResponse(`${messages.user} ${messages.signin}`, { token }));
      } else {
        return res.send(rs.incorrectDetails());
      }
    } else {
      return res.send(rs.incorrectDetails());
    }
  } catch (err) {
    return res.send(rs.errorResponse(err.toString()));
  }
};
