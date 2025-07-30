const express = require("express");
const { v4: uuidv4 } = require("uuid");
const {
  decodeAccessToken,
} = require("../../utils/jwtToken/customTokenService");
const Transaction = require("../../models/transaction-module/transaction.model");
const getMomoToken = require("../../utils/momo-mtn/getToken");
const axios = require("axios");
const {
  TransactionTypeEnum,
  PaymentStatusEnum,
} = require("../../utils/constants/ENUM");
const { requestToPayValidation } = require("./reqtopay.validator");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const statusCode = require("../../utils/constants/statusCode");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const UserModel = require("../../models/user-module/users/user.model");
const BusOperatorModel = require("../../models/bus-module/bus-operator/bus-operator.model");
const HotelManagerModel = require("../../models/hotel-module/hotel-manager/hotel-manager.model");
const Wallet = require("../../models/wallet-module/wallets.model");

const requestTopay = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);

  const userId = decoded?._id;
  const phoneNumber = decoded?.phoneNumber;

  if (!userId || !phoneNumber) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const userExists = await UserModel.findById(userId);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const { error, value } = requestToPayValidation.validate(req.body);
  const currency = process.env.MOMO_CURRENCY;

  if (error) {
    throw new ApiError(statusCode.BAD_REQUEST, error.details[0].message);
  }

  const { amount, description } = value;

  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Wallet not found. Please complete OTP verification first."
    );
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
      payer: { partyIdType: "MSISDN", partyId: phoneNumber },
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

  return res.status(statusCode.OK).json(
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

const withdrawFunds = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);
  const userId = decoded?._id;
  const phoneNumber = decoded?.phoneNumber;

  if (!userId || !phoneNumber) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { entity, amount, description } = req.body;
  const currency = process.env.MOMO_CURRENCY;

  if (!entity || !["busOperator", "hotelManager"].includes(entity)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid entity");
  }

  let Model,
    walletQuery = {};
  if (entity === "busOperator") {
    Model = BusOperatorModel;
    walletQuery.userId = userId;
  } else {
    Model = HotelManagerModel;
    walletQuery.userId = userId;
  }

  const entityExists = await Model.findById(userId);
  if (!entityExists) {
    throw new ApiError(statusCode.NOT_FOUND, `${entity} not found`);
  }

  const wallet = await Wallet.findOne(walletQuery);
  if (!wallet) throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");

  if (wallet.balance - amount < 1000) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "You must keep a minimum balance of 1000"
    );
  }

  const referenceId = uuidv4();
  const accessToken = await getMomoToken({
    subscriptionKey: process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
    apiUser: process.env.MOMO_DISBURSEMENT_API_USER,
    apiKey: process.env.MOMO_DISBURSEMENT_API_KEY,
    env: "disbursement",
  });

  await axios.post(
    `${process.env.MOMO_BASE_URL}/disbursement/v1_0/transfer`,  
    {
      amount: amount.toString(),
      currency,
      externalId: `wallet_withdraw_${userId}`,
      payee: { partyIdType: "MSISDN", partyId: phoneNumber },
      payerMessage: description || "Wallet Withdrawal",
      payeeNote: description || "Wallet Withdrawal",
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": process.env.MOMO_TARGET_ENVIRONMENT,
        "Ocp-Apim-Subscription-Key":
          process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  await Transaction.create({
    [entity === "busOperator" ? "busOperatorId" : "hotelManagerId"]: userId,
    transactionId: uuidv4(),
    momoRefId: referenceId,
    type: TransactionTypeEnum.DEBIT,
    amount,
    currency,
    description: description || "Withdraw via MoMo",
    status: PaymentStatusEnum.PENDING,
    withdraw:true
  });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { referenceId },
        "Withdraw initiated successfully"
      )
    );
});

module.exports = { requestTopay, withdrawFunds };
