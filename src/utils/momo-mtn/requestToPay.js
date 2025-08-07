const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const getMomoToken = require("./getToken");

async function requestToPay({ userId, amount, phone, currency, description }) {
  const referenceId = uuidv4();
  const accessToken = await getMomoToken({
    subscriptionKey: process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY,
    apiUser: process.env.MOMO_COLLECTION_API_USER,
    apiKey: process.env.MOMO_COLLECTION_API_KEY,
    env: "collection",
  });

  const response = await axios.post(
    `${process.env.MOMO_BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: amount.toString(),
      currency,
      externalId: `wallet_topup_${userId}`,
      payer: { partyIdType: "MSISDN", partyId: phone },
      payerMessage: description,
      payeeNote: description,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": "sandbox",
        "Ocp-Apim-Subscription-Key": process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  return { referenceId }; // Save this to your DB for status tracking
}

module.exports=requestToPay