const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const ejs = require("ejs");
const path = require("path");
const {
  aws_region,
  aws_access_key_id,
  aws_secret_access_key,
  email_from,
} = require("../../config/config");

const sesClient = new SESClient({
  region: aws_region,
  credentials: {
    accessKeyId: aws_access_key_id,
    secretAccessKey: aws_secret_access_key,
  },
});

async function sendEmail({ to, name, otp, template }) {
  try {
    console.log({
      aws_region,
      aws_access_key_present: !!aws_access_key_id,
      aws_secret_key_present: !!aws_secret_access_key,
    });

    console.log("GOtCha email");

    const templatePath = path.join(process.cwd(), "src", "templates", template);
    console.log("Resolved template path:", templatePath);

    const emailContent = await ejs.renderFile(templatePath, { name, otp });

    const command = new SendEmailCommand({
      Source: email_from,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: "Your OTP Code",
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: emailContent,
            Charset: "UTF-8",
          },
        },
      },
    });

    const response = await sesClient.send(command);
    console.log("Email sent successfully:", response.MessageId);

    return response;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

module.exports = sendEmail;
