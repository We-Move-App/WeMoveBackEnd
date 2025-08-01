// utils/momo/getToken.js
const axios = require("axios");
const base64 = require("base-64");

async function getMomoToken({ subscriptionKey, apiUser, apiKey, env = "collection" }) {
  const baseURL = env === "collection"
    ? "https://sandbox.momodeveloper.mtn.com/collection/token/"
    : "https://sandbox.momodeveloper.mtn.com/disbursement/token/";

  const auth = base64.encode(`${apiUser}:${apiKey}`);

  try {
    const response = await axios.post(baseURL, null, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });
    return response.data.access_token;
  } catch (err) {
    console.error("MoMo Token Error:", err.response?.data || err.message);
    throw new Error("Failed to get MoMo token");
  }
}

module.exports = getMomoToken;
