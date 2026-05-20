const axios = require("axios");

const sendSms = async ({
  to,
  content,
  sender = process.env.SMS_SENDER,
  type = "transactional",
  webUrl,
}) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    if (!to) {
      throw new Error("Recipient phone number (to) is required");
    }

    if (!content) {
      throw new Error("SMS content is required");
    }

    const payload = {
      sender,
      recipient: to,
      content,
      type,
    };

    if (webUrl) {
      payload.webUrl = webUrl;
    }

    const response = await axios.post(
      "https://api.brevo.com/v3/transactionalSMS/sms",
      payload,
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
      }
    );

    console.log("SMS sent", response.data);

    return {
      success: true,
      messageId: response.data.messageId,
      data: response.data,
    };
  } catch (error) {
    console.error("Brevo SMS Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to send SMS");
  }
};

module.exports = { sendSms };
