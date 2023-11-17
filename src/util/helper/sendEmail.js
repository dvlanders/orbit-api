const nodemailer = require("nodemailer");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");

const transport = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.generateEmail = async function (mailDetails, fullName) {
  let emailPath = path.join(__dirname, `../template/${mailDetails.fileName}`);

  const ejsTemplate = fs.readFileSync(emailPath, "utf8"); // Read the EJS template file

  const htmlContent = ejs.render(ejsTemplate, {
    resetUrl: mailDetails?.resetLink,
    recipientName: fullName,
    otp: mailDetails?.otp,
  });

  let email = transport.sendMail({
    from: mailDetails.from,
    to: mailDetails.to,
    subject: mailDetails.subject,
    text: mailDetails.text,
    html: htmlContent,
  });
  return email;
};
