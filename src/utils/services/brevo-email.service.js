const axios = require("axios");

const sendEmail = async ({
  toEmail,
  toName = "",
  subject,
  htmlContent,
  textContent,
}) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const payload = {
      sender: {
        name: process.env.EMAIL_SENDER_NAME,
        email: process.env.EMAIL_SENDER_EMAIL,
      },
      to: [
        {
          email: toEmail,
          name: toName,
        },
      ],
      subject,
      htmlContent,
    };

    if (textContent) {
      payload.textContent = textContent;
    }

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
      }
    );

    console.log("Email sent", response.data);

    return {
      success: true,
      messageId: response.data.messageId,
      data: response.data,
    };
  } catch (error) {
    console.error("Brevo Email Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to send email");
  }
};

module.exports = { sendEmail };
