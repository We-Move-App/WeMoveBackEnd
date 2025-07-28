// routes/requestToPay.js
const express = require("express");
const momoRouter = express.Router();
const { v4: uuidv4 } = require("uuid");

const Wallet = require("../../models/wallet-module/wallets.model");
const Transaction = require("../../models/transaction-module/transaction.model");
const getMomoToken = require("../../utils/momo-mtn/getToken");
const axios = require("axios");
const { WalletCurrencyEnum, TransactionTypeEnum, PaymentStatusEnum } = require("../../utils/constants/ENUM");
const { requestToPayValidation } = require("./reqtopay.validator");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const statusCode = require("../../utils/constants/statusCode");
const ApiError = require("../../utils/response/ApiError");
const generateUniqueCardNumber = require("../../utils/customId/generateUniqueCardNumber");
const ApiResponse = require("../../utils/response/ApiResponse");

const requestTopay = catchAsyncError(async (req, res) => {
  const { error, value } = requestToPayValidation.validate(req.body);
  if (error) {
    throw new ApiError(statusCode.BAD_REQUEST, error.details[0].message);
  }

  const { userId, phone, amount, currency, description } = value;

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({
      userId,
      balance: 0,
      currency: WalletCurrencyEnum[currency] || WalletCurrencyEnum.XAF,
      cardNumber: await generateUniqueCardNumber(),
    });
  }

  const referenceId = uuidv4();
  const accessToken = await getMomoToken({
    subscriptionKey: process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY,
    apiUser: process.env.MOMO_COLLECTION_API_USER,
    apiKey: process.env.MOMO_COLLECTION_API_KEY,
    env: "collection",
  });

  await axios.post(
    `${process.env.MOMO_BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: amount.toString(),
      currency,
      externalId: `wallet_topup_${userId}`,
      payer: { partyIdType: "MSISDN", partyId: phone },
      payerMessage: description || "Wallet Top-up",
      payeeNote: description || "Wallet Top-up",
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": process.env.MOMO_TARGET_ENVIRONMENT,
        "Ocp-Apim-Subscription-Key":
          process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  const transaction = await Transaction.create({
    userId,
    transactionId: uuidv4(),
    momoRefId: referenceId,
    type: TransactionTypeEnum.CREDIT,
    amount,
    currency,
    description: description || "Top-up via MoMo",
    status: PaymentStatusEnum.PENDING,
  });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        {
          referenceId,
          transactionId: transaction.transactionId,
        },
        "Request to pay initiated"
      )
    );
});

module.exports = {requestTopay};
