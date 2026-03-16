const fs = require("fs");
const path = require("path");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const {
  fetchLn,
  fetchDriverLn,
} = require("../../utils/services/user.services");

const privacyPolicy = catchAsyncError(async (req, res) => {
  const _id = req.user._id;
  const role = req.user.role;

  let ln = await fetchLn(_id);

  if (role === "driver") {
    ln = await fetchDriverLn(_id);
  }

  const folder = role === "driver" ? "drivers" : "users";

  let filePath = path.join(
    __dirname,
    `../../static/${folder}/privacy_policy_eng.html`
  );

  if (ln === "fr") {
    filePath = path.join(
      __dirname,
      `../../static/${folder}/privacy_policy_fr.html`
    );
  }

  const html = fs.readFileSync(filePath, "utf8");

  res.set("Content-Type", "text/html");
  res.send(html);
});

const termsAndCondition = catchAsyncError(async (req, res) => {
  const _id = req.user._id;
  const role = req.user.role;

  let ln = await fetchLn(_id);

  if (role === "driver") {
    ln = await fetchDriverLn(_id);
  }

  const folder = role === "driver" ? "drivers" : "users";

  let filePath = path.join(__dirname, `../../static/${folder}/t&c_eng.html`);

  if (ln == "fr") {
    filePath = path.join(__dirname, `../../static/${folder}/t&c_fr.html`);
  }

  const html = fs.readFileSync(filePath, "utf8");

  res.set("Content-Type", "text/html");
  res.send(html);
});

const generalDisclaimer = catchAsyncError(async (req, res) => {
  const _id = req.user._id;
  const role = req.user.role;

  let ln = await fetchLn(_id);

  if (role === "driver") {
    ln = await fetchDriverLn(_id);
  }

  let filePath = path.join(
    __dirname,
    `../../static/general-disclaimer/gen_disclaimer_eng.html`
  );

  if (ln == "fr") {
    filePath = path.join(
      __dirname,
      `../../static/general-disclaimer/gen_disclaimer_fr.html`
    );
  }

  const html = fs.readFileSync(filePath, "utf8");

  res.set("Content-Type", "text/html");
  res.send(html);
});

module.exports = { privacyPolicy, termsAndCondition, generalDisclaimer };
