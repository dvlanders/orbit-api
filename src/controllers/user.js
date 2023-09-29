
const { v4: uuidv4 } = require("uuid");
const client = require("../config/db.conf");
const validateSchema = require("../util/ValidatorSchema/index")
const valid = require("../util/Validator")
const Ajv = require("ajv");
const ajv = new Ajv();
const User = require("../models/user")
const speakeasy = require("speakeasy");
const registration = require("./index")
const { sendEmail, common } = require("../util/helper");

const resetPassword = process.env.RESET_PASSWORD

exports.signUp = async (req, res) => {
  try {
    let generate;
    const {fullName, email, businessName, phoneNumber} = req.body
    if(email && phoneNumber){
      console.log(email)
    let validation = valid.validateObject({email, phoneNumber},validateSchema.userSchema.signup)
    if(!validation[0]) return res.status(400).json({error : `${ajv.errorsText(validation[1].errors)}`});
    
    req.body.id = uuidv4();
    const password = "123456";
      let link = "https://forms.gle/62ebRR5EicyW2iVg6";
      let mailDetails = {
        from: "kaushiki.mobilefirst@gmail.com",
        to: email,
        subject: "Test mail",
        text: `Please fill up the google form, \n ${link}`,
      };
      generate = await sendEmail.generateEmail(mailDetails);
    if (generate.messageId) {
      let cipherText = common.encryptText(password);
      req.body.password = cipherText;
      let user = await User.create(req.body);
      if(user){
      return res.status(200).json({
        message:
          "Account registered, please check your email for further process",
        data: user
        
      });
    }
  }else{
    return res.status(400).json({
      error:
        "please provide email or phone Number",
    });
  }
  }
} catch (error) {
    console.log("err", error);
    return res.status(400).json({ error: error.message });
  }
};

exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    if(email && password){
    let validation = valid.validateObject({email, password},validateSchema.userSchema.signin)
    if(!validation[0]) return res.status(400).json({error :  `${ajv.errorsText(validation[1].errors)}`});
    let getUser = await User.findAll({where : {email : email}})
    if(getUser.length > 0){
      let decryptText = common.decryptText(getUser[0].password)
      if (decryptText !== password){
      return res.status(401).json({message: "Please Enter the valid password"});
      }

      let temp_secret = speakeasy.generateSecret();
      let addKey = await User.update({secretKey :temp_secret.base32},{ where : {email :email}})
      if(addKey) {
      return res.status(200).json({
        data: {
        email,
        secret: temp_secret.base32,
        qr_code: temp_secret.otpauth_url,
        }
      });
    }
    }else{
      return res.status(400).json({message:"please provide valid email"});
    }
  }else{
    return res.status(400).json({message:"please provide email or password"});
  }
  } catch (error) {
    return res.json({ error: error });
  }
};

exports.verifyTOTP = async(req,res) => {
  try{
    const { token } = req.body;
    const {userId} = req.params;
    let key = await User.findOne({where : {id: userId}})
    let secret = key.secretKey
    console.log("sddddddddddddddd",secret,token)
      const verified = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token,
      });
      console.log("ddddddddddddddddddddd",verified)
      if (verified) {
        // db.push(path, { id: userId, secret: user.temp_secret });
        res.status(200).json({ verified: true });
      } else {
        res.status(400).json({ verified: false });
      }
  }catch(err){
    return res.json({ error: err.toString() });
  }
}


exports.forgotPassword = async(req,res) =>{
  try{
    const { email} = req.body
    let getUser = await User.findAll({where : {email : email}})
    if (getUser.length ==  0)
      return res.status(500).json({
        message: "Please Enter the valid email",
      });
    let mailDetails = {
        from: "kaushiki.mobilefirst@gmail.com",
        to: email,
        subject: "Test mail",
        text: `Please click on the link to reset the password ${resetPassword}`,
      };
      generate = await sendEmail.generateEmail(mailDetails);
      if(generate.messageId){
    return res.status(200).json({
      message: "Please check email to reset password",
      data: {
        id: getUser[0].id,
        email: getUser[0].email,
      },
    });}
  }catch(error){
    return res.json({ error: error.toString() });
  }
}

exports.resetPassword = async(req,res) =>{
  try{
    const { newPassword, confirmPassword} = req.body
    const {userId} = req.params
    let getUsers = await User.findAll({where: {id: userId}})
    if(getUsers.length > 0){
    
      if(newPassword && confirmPassword){
        if(newPassword !== confirmPassword){
        return res.status(500).json({ message: "New Password does not match with confirm password",});
        }
        let cipherText = common.encryptText(confirmPassword);
        req.body.confirmPassword = cipherText;
        let updatePassword = await User.update({password: req.body.confirmPassword},{where : {id : userId}})
        if(updatePassword.length > 0){
          return res.status(200).json({message: "Password Updated successfully",data: {id : getUsers[0].id},});
        }
        else{
          return res.status(401).json({ message: "Password not updated successfully, please try again"});
        }
      }else{
        return res.status(400).json({ message: "Please provider new password and confirm password",});
      }
    }
  }catch(error){
    return res.status(500).json({ error: error });
  }

}

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword} = req.body;
    const {userId} = req.params
    let getUser = await User.findAll({where : {id : userId }})
    if(getUser.length > 0 && currentPassword){
      if(newPassword && confirmPassword){
        let decryptText = common.decryptText(getUser[0].password);
        if (currentPassword !== decryptText)
         return res.status(500).json({message: "Please enter your current password correct",});
        if (newPassword !== confirmPassword)
         return res.status(500).json({ message: "New Password does not match with confirm password",});
         let cipherText = common.encryptText(confirmPassword);
         req.body.confirmPassword = cipherText;
         let updatePassword = await User.update({password:req.body.confirmPassword},{where : {id : userId}})
         if(updatePassword.length > 0){
         return res.status(200).json({ message: "Password Updated successfully",data: {id: getUser[0].id},});
         }
         else{
         return res.status(401).json({ message: "Password not updated successfully",});
         }
      }else{  return res.status(400).json({ message: "Please provider new password and confirm password",});
      }
    }
    else{
      return res.status(400).json({message: "Please provide current password",});
    }
  } catch (error) {
    return res.status(500).json({ error: error.toString() });
  }
};
