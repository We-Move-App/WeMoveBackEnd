const puppeteer = require("puppeteer");
const {
  getHotelInvoiceHTML,
  getTransactionReceiptHTML,
} = require("./template-html");

const fs = require("fs");
const path = require("path");

const generateHotelInvoiceBase64 = async (booking) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
  });

  // ✅ Read logo from same folder (invoice-module)
  const logoPath = path.join(__dirname, "wemove-logo.png");
  const logoBase64 = fs.readFileSync(logoPath).toString("base64");
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  const html = getHotelInvoiceHTML(booking, logoDataUrl);

  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBytes = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  });

  await browser.close();

  // ✅ IMPORTANT: Uint8Array -> Buffer -> base64
  return Buffer.from(pdfBytes).toString("base64");
};

const generateTransactionReceiptBase64 = async (txn) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // mobile viewport to match your design
  await page.setViewport({
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
  });

  // ✅ inline logo as base64
  const logoPath = path.join(__dirname, "wemove-logo.png");
  const logoBase64 = fs.readFileSync(logoPath).toString("base64");
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  const html = getTransactionReceiptHTML(txn, logoDataUrl);

  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBytes = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  });

  await browser.close();

  return Buffer.from(pdfBytes).toString("base64");
};

module.exports = {
  generateHotelInvoiceBase64,
  generateTransactionReceiptBase64,
};
