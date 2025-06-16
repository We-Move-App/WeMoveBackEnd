const nodemailer = require("nodemailer");
const ejs = require("ejs");
const sgMail = require("@sendgrid/mail");
const path = require("path");
const {
  smtp_service,
  email_user,
  email_pass,
  smtp_port,
  smtp_host,
  email_from,
  sendgrid_api_key,
  email_from_for_send_grid,
} = require("../../config/config");
require("dotenv").config();
const fs = require("fs");

async function sendEmailUsingNodemailer({
  to,
  subject,
  template,
  params = {},
}) {
  try {
    const templatePath = path.join(__dirname, "../../mailTemplates", template);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template not found: ${template}`);
    }

    const emailContent = await ejs.renderFile(templatePath, params);

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
      subject,
      html: emailContent,
    });

    console.log("Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("Failed to send email:", error.message);
    throw error;
  }
}

// sgMail.setApiKey(sendgrid_api_key);

async function sendEmailUsingSendGrid({ to, subject, template, params = {} }) {
  // try {
  //   const templatePath = path.join(__dirname, "../../mailTemplates", template);
  //   if (!fs.existsSync(templatePath)) {
  //     throw new Error(`Email template not found: ${template}`);
  //   }
  //   const emailContent = await ejs.renderFile(templatePath, params);
  //   const msg = {
  //     to,
  //     from: email_from_for_send_grid,
  //     subject,
  //     html: emailContent,
  //   };
  //   const response = await sgMail.send(msg);
  //   console.log("Email sent successfully:", response[0].statusCode);
  // } catch (error) {
  //   console.error("Failed to send email:", error.message);
  //   throw error;
  // }
}

module.exports = { sendEmailUsingNodemailer, sendEmailUsingSendGrid };
