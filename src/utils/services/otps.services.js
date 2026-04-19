require("dotenv").config();
const { twilio_phone_number, node_env } = require("../../config/config");
const twilioClient = require("../../config/twilioConfig");
const logger = require("../logger/logger");

const sendOtpToPhoneNumbers = async (phoneNumber, otp) => {
  logger.info(`Otp is triggered to ${phoneNumber}`);

  try {
    if (!phoneNumber || !otp) {
      throw new Error("Phone number and OTP are required.");
    }

    // Ensure phone number is in E.164 format
    if (!phoneNumber.startsWith("+")) {
      throw new Error(
        "Phone number must be in E.164 format (e.g., +971XXXXXXXXX)."
      );
    }

    const message = await twilioClient.messages.create({
      body: `Here is your OTP for WeMove: ${otp}. It expires in 10 minutes.`,
      from: twilio_phone_number || process.env.TWILIO_PHONE_NUMBER, // Fallback if missing
      to: phoneNumber,
    });

    console.log(`✅ OTP sent successfully: ${message.sid}`);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error(` Error sending OTP: ${error.message}`, {
      phoneNumber,
      error: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message };
  }
};

// const getOtp = () =>{
//   let otp

//   if(node_env!=='production')
//     {
//       otp = "1234"
//     }
//     else
//     {
//       const generateOtp = () => {
//         return Math.floor(1000 + Math.random() * 9000).toString();
//       };
//       otp = generateOtp
//     }

//     return otp
// }
const getOtp = () => {
  // return Math.floor(1000 + Math.random() * 9000).toString();
  return "1234";
};

module.exports = { sendOtpToPhoneNumbers, getOtp };
