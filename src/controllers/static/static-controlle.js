const fs = require("fs");
const path = require("path");
const catchAsyncError = require("../../utils/response/catchAsyncError");

const privacyPolicy = catchAsyncError(async (req, res) => {
  const filePath = path.join(__dirname, "../../static/privacy-policy.html");

  const html = fs.readFileSync(filePath, "utf8");

  res.set("Content-Type", "text/html");
  res.send(html);
});

const termsAndCondition = catchAsyncError(async (req, res) => {
  const filePath = path.join(__dirname, "../../static/t-and-c.html");

  const html = fs.readFileSync(filePath, "utf8");

  res.set("Content-Type", "text/html");
  res.send(html);
});

module.exports = { privacyPolicy, termsAndCondition };
