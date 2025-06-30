const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const {
  email_user,
  email_pass,
  smtp_service,
  smtp_port,
  smtp_host,
  email_from,
} = require("../../config/config");
require("dotenv").config();

async function sendEmail({ to, name, otp, template }) {

  try {
    const templatePath = path.join(__dirname, "../../mailTemplates", template);
    console.log("Resolved template path:", templatePath);
    const emailContent = await ejs.renderFile(templatePath, { name, otp });

    const transporter = nodemailer.createTransport({
      service: smtp_service,
      auth: {
        user: email_user,
        pass: email_pass,
      },
      port: parseInt(smtp_port || "587"),
      host: smtp_host,
    });

    const info = await transporter.sendMail({
      from: email_from,
      to,
      subject: "Your OTP Code",
      html: emailContent,
    });

    console.log("Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("Failed to send email:", error.message);
    throw error;
  }
}

module.exports = sendEmail;
