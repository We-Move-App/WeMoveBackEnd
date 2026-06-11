require("dotenv").config();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const {
  momo_collection_primary_key,
  momo_disbursement_primary_key,
  momo_collection_user_id,
  momo_disbursement_user_id,
  momo_collection_api_key,
  momo_disbursement_api_key,
  momo_base_url,
  momo_target_environment,
} = require("../../config/config");

const BASE_URL = momo_base_url;
const COLLECTION_PRIMARY_KEY = momo_collection_primary_key;
const DISBURSEMENT_PRIMARY_KEY = momo_disbursement_primary_key;
const COLLECTION_USER_ID = momo_collection_user_id;
const DISBURSEMENT_USER_ID = momo_disbursement_user_id;
const COLLECTION_API_KEY = momo_collection_api_key;
const DISBURSEMENT_API_KEY = momo_disbursement_api_key;
const MOMO_TARGET_ENV = momo_target_environment;

// Generate access token
const getAccessToken = async (type) => {
  const userId =
    type === "collections" ? COLLECTION_USER_ID : DISBURSEMENT_USER_ID;
  const apiKey =
    type === "collections" ? COLLECTION_API_KEY : DISBURSEMENT_API_KEY;
  const primaryKey =
    type === "collections" ? COLLECTION_PRIMARY_KEY : DISBURSEMENT_PRIMARY_KEY;

  const auth = Buffer.from(`${userId}:${apiKey}`).toString("base64");

  const response = await axios.post(
    `${BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Ocp-Apim-Subscription-Key": primaryKey,
      },
    }
  );
  return response.data.access_token;
};

// User send money to Admin
// Add money to wallet (Request to Pay)
// phone Number : who is sending money/ payer
const addMoney = async (amount, phoneNumber) => {
  const accessToken = await getAccessToken("collections");
  const referenceId = uuidv4();

  await axios.post(
    `${BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount,
      currency: process.env.MOMO_CURRENCY,
      externalId: referenceId,
      payer: { partyIdType: "MSISDN", partyId: phoneNumber },
      payerMessage: "Deposit to wallet",
      payeeNote: "Adding money to wallet",
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": referenceId,
        "Ocp-Apim-Subscription-Key": COLLECTION_PRIMARY_KEY,
        "Content-Type": "application/json",
        "X-Target-Environment": MOMO_TARGET_ENV,
      },
    }
  );
  return { message: "Deposit request initiated", referenceId };
};

// Admin send money to service providers or user
// Withdraw money from wallet // Transfer money : refunds
const transferMoney = async (amount, phoneNumber) => {
  const accessToken = await getAccessToken("disbursements");
  const referenceId = uuidv4();

  await axios.post(
    `${BASE_URL}/disbursement/v1_0/transfer`,
    {
      amount,
      currency: process.env.MOMO_CURRENCY,
      externalId: referenceId,
      payee: { partyIdType: "MSISDN", partyId: phoneNumber },
      payerMessage: "Funds transfer",
      payeeNote: "Money received",
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": referenceId,
        "Ocp-Apim-Subscription-Key": DISBURSEMENT_PRIMARY_KEY,
        "Content-Type": "application/json",
        "X-Target-Environment": MOMO_TARGET_ENV,
      },
    }
  );
  return { message: "Withdrawal request initiated", referenceId };
};

// Pre-Approval - Set up auto-debit for a customer
const preApproval = async (phoneNumber) => {
  const accessToken = await getAccessToken("collections");
  const referenceId = uuidv4();

  await axios.post(
    `${BASE_URL}/collection/v1_0/preapproval`,
    {
      payee: { partyIdType: "MSISDN", partyId: phoneNumber },
      payerMessage: "Pre-approval request",
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": referenceId,
        "Ocp-Apim-Subscription-Key": COLLECTION_PRIMARY_KEY,
        "Content-Type": "application/json",
        "X-Target-Environment": MOMO_TARGET_ENV,
      },
    }
  );
  return { message: "Pre-approval request sent", referenceId };
};

const getBalance = async () => {
  try {
    const accessToken = await getAccessToken("collections");
    const referenceId = uuidv4();
    const response = await axios.get(
      `${BASE_URL}/collection/v1_0/account/balance`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Ocp-Apim-Subscription-Key": COLLECTION_PRIMARY_KEY,
          "X-Target-Environment": MOMO_TARGET_ENV,
          // "Cache-Control": "no-cache",
          "X-Reference-Id": referenceId,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error in getBalance:",
      error.response?.data || error.message
    );
    return { error: error.message };
  }
};

const getUserBalance = async (phoneNumber) => {
  try {
    const accessToken = await getAccessToken("collections"); // Get authentication token

    const response = await axios.get(
      `${BASE_URL}/collection/v1_0/accountholder/MSISDN/${phoneNumber}/active`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Ocp-Apim-Subscription-Key": COLLECTION_PRIMARY_KEY,
          "X-Target-Environment": MOMO_TARGET_ENV,
        },
      }
    );

    return {
      message: "Balance retrieved successfully",
      balance: response.data,
    };
  } catch (error) {
    console.error(
      "Error fetching balance:",
      error.response?.data || error.message
    );
    return { message: "Failed to fetch balance", error: error.message };
  }
};

// Get transaction status : Working
const getTransactionStatus = async (id) => {
  const accessToken = await getAccessToken("collections");
  const response = await axios.get(
    `${BASE_URL}/collection/v1_0/requesttopay/${id}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Ocp-Apim-Subscription-Key": COLLECTION_PRIMARY_KEY,
        "X-Target-Environment": MOMO_TARGET_ENV,
      },
    }
  );
  return response.data;
};

const checkBankAccount = async (phoneNumber) => {
  try {
    const accessToken = await getAccessToken("collections");
    const response = await axios.get(
      // `${BASE_URL}/collection/v1_0/accountholder/MSISDN/${phoneNumber}/active`,
      `${BASE_URL}/collection/v1_0/accountholder/msisdn/${phoneNumber}/active`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Ocp-Apim-Subscription-Key": COLLECTION_PRIMARY_KEY,
          "X-Target-Environment": MOMO_TARGET_ENV,
        },
      }
    );

    console.log("Response Data:", response.data);
    return { exists: response.data.result === "true" };
  } catch (error) {
    console.error(
      "Error checking bank account:",
      error.response?.data || error.message
    );
    return { exists: false, error: error.message };
  }
};

module.exports = {
  addMoney,
  transferMoney,
  getBalance,
  getTransactionStatus,
  checkBankAccount,
  getAccessToken,
  getUserBalance,
  preApproval,
};
