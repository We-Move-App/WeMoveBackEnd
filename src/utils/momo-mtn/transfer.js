// services/transfer.js
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const getMomoToken = require("./getToken");

async function transferAmount({ userId, amount, phone, currency, description }) {
  const referenceId = uuidv4();
  const accessToken = await getMomoToken({
    subscriptionKey: process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
    apiUser: process.env.MOMO_DISBURSEMENT_API_USER,
    apiKey: process.env.MOMO_DISBURSEMENT_API_KEY,
    env: "disbursement",
  });

  const response = await axios.post(
    "https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer",
    {
      amount: amount.toString(),
      currency,
      externalId: `wallet_payout_${userId}`,
      payee: { partyIdType: "MSISDN", partyId: phone },
      payerMessage: description,
      payeeNote: description,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": "sandbox",
        "Ocp-Apim-Subscription-Key": process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  return { referenceId };
}


module.exports=transferAmount