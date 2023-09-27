const nodemailer = require("nodemailer");

const transport= nodemailer.createTransport({
  host:"smtp-relay.sendinblue.com",
  auth: {
    user: "sultan.mobilefirst@gmail.com",
    pass: "b7yER3rILcPmz9Nd",
  },
});

exports.generateEmail= async function(mailDetails) {
 let email = transport.sendMail(mailDetails);
 return email
}


