const OtpModel = require("../../models/otp-module/otp.model");
const sgMail = require("@sendgrid/mail");
const { translateLn } = require("../../utils/services/translator.service");
const { sendEmail } = require("../services/brevo-email.service");
const {
  generateOtpEmailTemplate,
} = require("../../templates/otpEmailTemplate");

// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const getOtp = () => {
  // return Math.floor(1000 + Math.random() * 9000).toString();
  return "1234";
};

const sendOtpToPhone = async (phoneNumber) => {
  const otp = getOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OtpModel.findOneAndUpdate(
    { contact: phoneNumber, type: "phone" },
    { otp, expiresAt, isUsed: false },
    { upsert: true, new: true }
  );

  // Placeholder for future SMS integration
  // e.g., await sendOtpToPhoneNumbers(phoneNumber, otp);

  return { otp, expiresAt };
};

const sendOtpToEmail = async (email) => {
  const otp = getOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OtpModel.findOneAndUpdate(
    { contact: email, type: "email" },
    { otp, expiresAt, isUsed: false },
    { upsert: true, new: true }
  );

  const { subject, htmlContent, textContent } = generateOtpEmailTemplate(otp);

  await sendEmail({
    toEmail: email,
    toName: "User",
    subject,
    htmlContent,
    textContent,
  });

  return {
    expiresAt,
  };
};

const verifyPhoneOtp = async (phoneNumber, otp, ln = "en") => {
  if (!phoneNumber || !otp) {
    throw new Error(translateLn(ln, "PHONE_AND_OTP_REQUIRED"));
  }

  const record = await OtpModel.findOne({
    contact: phoneNumber,
    type: "phone",
  });

  if (!record) {
    throw new Error(translateLn(ln, "OTP_NOT_FOUND"));
  }

  if (record.isUsed) {
    throw new Error(translateLn(ln, "OTP_ALREADY_USED"));
  }

  if (record.otp !== otp) {
    throw new Error(translateLn(ln, "INVALID_OTP"));
  }

  if (record.expiresAt < new Date()) {
    throw new Error(translateLn(ln, "OTP_EXPIRED"));
  }

  record.isUsed = true;
  await record.save();

  return { verified: true, message: "Phone OTP verified successfully." };
};

const verifyEmailOtp = async (email, otp, ln = "en") => {
  if (!email || !otp) {
    throw new Error("Email and OTP are required");
  }

  const record = await OtpModel.findOne({ contact: email, type: "email" });

  if (!record) {
    throw new Error(translateLn(ln, "OTP_NOT_FOUND"));
  }

  if (record.isUsed) {
    throw new Error(translateLn(ln, "OTP_ALREADY_USED"));
  }

  if (record.otp !== otp) {
    throw new Error(translateLn(ln, "INVALID_OTP"));
  }

  if (record.expiresAt < new Date()) {
    throw new Error(translateLn(ln, "OTP_EXPIRED"));
  }

  record.isUsed = true;
  await record.save();

  return { verified: true, message: "Email OTP verified successfully." };
};

module.exports = {
  getOtp,
  sendOtpToPhone,
  sendOtpToEmail,
  verifyPhoneOtp,
  verifyEmailOtp,
};
