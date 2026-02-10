const OtpModel = require("../../models/otp-module/otp.model");
const sgMail = require("@sendgrid/mail");
const sendEmail = require("../emailService/sendEmail");

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

  await sendEmail({
    to: email,
    name: email.split("@")[0],
    otp,
    template: "otp.ejs",
  });

  return {
    expiresAt,
  };
};

const verifyPhoneOtp = async (phoneNumber, otp) => {
  if (!phoneNumber || !otp) {
    throw new Error("Phone number and OTP are required");
  }

  const record = await OtpModel.findOne({
    contact: phoneNumber,
    type: "phone",
  });

  if (!record) {
    throw new Error("OTP not found. Please request a new one.");
  }

  if (record.isUsed) {
    throw new Error("OTP has already been used.");
  }

  if (record.otp !== otp) {
    throw new Error("Invalid OTP.");
  }

  if (record.expiresAt < new Date()) {
    throw new Error("OTP has expired.");
  }

  record.isUsed = true;
  await record.save();

  return { verified: true, message: "Phone OTP verified successfully." };
};

const verifyEmailOtp = async (email, otp) => {
  if (!email || !otp) {
    throw new Error("Email and OTP are required");
  }

  const record = await OtpModel.findOne({ contact: email, type: "email" });

  if (!record) {
    throw new Error("OTP not found. Please request a new one.");
  }

  if (record.isUsed) {
    throw new Error("OTP has already been used.");
  }

  if (record.otp !== otp) {
    throw new Error("Invalid OTP.");
  }

  if (record.expiresAt < new Date()) {
    throw new Error("OTP has expired.");
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
