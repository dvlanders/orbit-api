// const htmlToPdf = require("html-pdf");
const path = require("path");
const ejs = require("ejs");
const fs = require("fs");

exports.generatePdf = (purchaseDetails) => {
  // return new Promise((resolve, reject) => {
  //   try {
  //     let fileName = "paymentReceipt.ejs";
  //     // HTML content for the PDF
  //     let htmlContentPath = path.join(__dirname, `../template/${fileName}`);

  //     const ejsTemplate = fs.readFileSync(htmlContentPath, "utf8"); // Read the EJS template file

  //     const htmlContent = ejs.render(ejsTemplate, {
  //       orderId: purchaseDetails?.orderId,
  //       totalAmount: purchaseDetails?.totalAmount,
  //       recipientName: purchaseDetails?.recipientName,
  //       productDescription: purchaseDetails?.productDescription,
  //       paymentAddress: purchaseDetails?.paymentAddress,
  //       paymentDate: purchaseDetails?.paymentDate,
  //     });

  //     // Configuration for html-pdf
  //     const pdfOptions = { format: "Letter" };

  //     // Convert HTML to PDF using html-pdf
  //     htmlToPdf.create(htmlContent, pdfOptions).toStream((err, pdfStream) => {
  //       if (err) {
  //         reject(err);
  //       } else {
  //         // Stream PDF data
  //         const buffers = [];
  //         pdfStream.on("data", (data) => buffers.push(data));
  //         pdfStream.on("end", () => {
  //           const pdfBuffer = Buffer.concat(buffers);
  //           resolve(pdfBuffer.toString("base64"));
  //         });
  //       }
  //     });
  //   } catch (error) {
  //     reject(error);
  //   }
  // });
};
