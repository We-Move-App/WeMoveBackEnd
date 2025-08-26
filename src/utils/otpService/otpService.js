const OtpModel = require("../../models/otp-module/otp.model");
const sgMail = require("@sendgrid/mail");

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

  // Save or update OTP
  await OtpModel.findOneAndUpdate(
    { contact: email, type: "email" },
    { otp, expiresAt, isUsed: false },
    { upsert: true, new: true }
  );

  // const message = {
  //   to: email,
  //   from: process.env.FROM_EMAIL, // must be a verified sender in SendGrid
  //   subject: "WeMove - Your One Time Password",
  //   text: `Your OTP is ${otp}`,
  //   html: `<h1>Your one time password: <b>${otp}</b></h1>`,
  // };

  // try {
  //   await sgMail.send(message);
  //   console.log("✅ Email sent to", email);

  //   // Always return consistent data
  //   return { success: true, otp, expiresAt };
  // } catch (err) {
  //   console.error("❌ Error sending email:", err);

  //   return { success: false, error: err.message };
  // }

  return { otp, expiresAt }; // comment this after uncomment the top one
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
