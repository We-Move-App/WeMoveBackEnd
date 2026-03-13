const fs = require("fs");
const path = require("path");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const { fetchLn } = require("../../utils/services/user.services");

const privacyPolicy = catchAsyncError(async (req, res) => {
  const _id = req.user._id;

  const ln = await fetchLn(_id);

  let filePath = path.join(
    __dirname,
    "../../static/users/privacy_policy_eng.html"
  );

  if (ln == "fr") {
    filePath = path.join(
      __dirname,
      "../../static/users/privacy_policy_fr.html"
    );
  }

  const html = fs.readFileSync(filePath, "utf8");

  res.set("Content-Type", "text/html");
  res.send(html);
});

const termsAndCondition = catchAsyncError(async (req, res) => {
  const _id = req.user._id;

  const ln = await fetchLn(_id);

  let filePath = path.join(__dirname, "../../static/users/t&c_eng.html");

  if (ln == "fr") {
    filePath = path.join(__dirname, "../../static/users/t&c_fr.html");
  }

  const html = fs.readFileSync(filePath, "utf8");

  res.set("Content-Type", "text/html");
  res.send(html);
});

const generalDisclaimer = catchAsyncError(async (req, res) => {
  const _id = req.user._id;

  const ln = await fetchLn(_id);

  let filePath = path.join(
    __dirname,
    "../../static/users/gen_disclaimer_eng.html"
  );

  if (ln == "fr") {
    filePath = path.join(
      __dirname,
      "../../static/users/gen_disclaimer_fr.html"
    );
  }

  const html = fs.readFileSync(filePath, "utf8");

  res.set("Content-Type", "text/html");
  res.send(html);
});

module.exports = { privacyPolicy, termsAndCondition, generalDisclaimer };
