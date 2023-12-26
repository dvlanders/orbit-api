const { responseCode, messages } = require("./index");

const {
  success,
  update,
  dataNotAdded,
  deleted,
  conflict,
  dataNotExist,
} = require("./Constants");

exports.response = (statusCode, message, data) => {
  return {
    statusCode,
    message,
    data: data || {},
  };
};

//________________ ERROR RESPONSE _____________________________//
exports.errorResponse = (err, resCode) => {
  return this.response(
    resCode || responseCode.serverError,
    messages.serverError,
    err
  );
};
// _______________ MIDDLEWARE RESPONSE ________________________//
exports.authErr = (err) => {
  return this.response(responseCode.unauthorized, messages.unauthorized, err);
};
//_____________________ INCORRECT ____________________//
exports.incorrectPassword = () => {
  return this.response(
    responseCode.unauthenticated,
    messages.incorrectPassword
  );
};

//_____________________TOKEN RESPONSE __________________________//
exports.tokenResponse = (token) => {
  return this.response(responseCode.success, messages.tokenGenerate, token);
};

//_____________________ SUCCESS RESPONSE _________________________//
exports.successResponse = (name, data) => {
  return this.response(responseCode.success, success(name), data);
};

exports.dataNotAdded = (name) => {
  return this.response(responseCode.successNoRecords, dataNotAdded(name));
};

exports.dataNotExist = (name) => {
  return this.response(responseCode.successNoRecords, dataNotExist(name));
};

exports.conflict = (name) => {
  return this.response(responseCode.conflict, conflict(name));
};

exports.incorrectDetails = (message, data) => {
  return this.response(responseCode.badRequest, message, data);
};

// async function testpdf(){
//   try {
//     let purchaseDetails = {
//       orderId: 12323,
//       totalAmount: 0.005422,
//       recipientName: "Jhon Doe",
//       productDescription: "This is description",
//       paymentAddress: "0x6bf8a49b8587896d689d73f1bbaf714f7d1ca08a",
//       paymentDate: "December 08, 2023, 12:41 AM",
//       currency: "eth",
//       walletType: 'walletconnect'
//     };

//     //  here topdf and then email service
//     // let pdfData = await generatePdf(purchaseDetails);

//     // console.log("pdfData");
//     // console.log(pdfData);

//     let mailDetails = {
//       from: `${process.env.FROM_EMAIL}`,
//       to: 'sultan.mobilefirst@gmail.com',
//       subject: "Payment By Customer",
//       fileName: "merchantDepositTemplate.ejs",
//       text: "Payment By Customer",
//     };
//     mailDetails = {...mailDetails, ...purchaseDetails}
//    let e =  await sendEmail.generateEmail(mailDetails);
//    console.log(e);
//   } catch (err) {
//     console.log(err.toString());
//   }
// }
// testpdf()