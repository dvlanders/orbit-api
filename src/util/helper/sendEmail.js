const nodemailer = require("nodemailer");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");

const transport = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  from: process.env.FROM_EMAIL,
  secure: false, // true for 465, false for other ports
  port: 587,
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
    recipientName: mailDetails?.fullName || fullName,
    otp: mailDetails?.otp,
    link: mailDetails?.link,
    password: mailDetails?.password,
  });

  let emailOptions = {
    from: mailDetails.from,
    to: mailDetails.to,
    subject: mailDetails.subject,
    text: mailDetails.text,
    html: htmlContent,
    attachments: [],
  };

  // Assuming 'file' is a boolean variable indicating whether to add an attachment
  if (mailDetails?.file) {
    emailOptions.attachments.push({
      filename: Date.now() + "_Payment_Receipt",
      content: mailDetails?.file,
      encoding: "base64",
    });
  }

  let email = transport.sendMail(emailOptions);
  return email;
};
