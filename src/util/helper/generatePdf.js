const path = require("path");
const ejs = require("ejs");
const fs = require("fs");
const puppeteer = require('puppeteer')

exports.generatePdf = async (purchaseDetails) => {
  try {
    let fileName = "paymentReceipt.ejs";
    // HTML content for the PDF
    let htmlContentPath = path.join(__dirname, `../template/${fileName}`);

    const ejsTemplate = fs.readFileSync(htmlContentPath, "utf8"); // Read the EJS template file

    // Compile EJS template
    const compiledTemplate = ejs.compile(ejsTemplate);

    const htmlContent = compiledTemplate({
      orderId: purchaseDetails?.orderId,
      totalAmount: purchaseDetails?.totalAmount,
      recipientName: purchaseDetails?.recipientName,
      productDescription: purchaseDetails?.productDescription,
      paymentAddress: purchaseDetails?.paymentAddress,
      paymentDate: purchaseDetails?.paymentDate,
    });
    const browser = await puppeteer.launch({
      headless: true, // or headless: "new" for the new headless mode
    });
    const page = await browser.newPage();
    // await page.setViewport({ width: 1920, height: 1080 });

    // Set the content of the page
    await page.setContent(htmlContent);

    await new Promise(resolve => setTimeout(resolve, 2000));
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true
    });

    // Close the browser
    await browser.close();

    return pdfBuffer.toString('base64');
  } catch (error) {
    throw error;
  }
};