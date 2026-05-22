const express = require("express");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
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
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");
const Wallet = require("../../models/wallet-module/wallets.model");
const { getIO } = require("../../socket");
const TransactionModel = require("../../models/transaction-module/transaction.model");
const { translateLn } = require("../../utils/services/translator.service");

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
  if (error)
    throw new ApiError(statusCode.BAD_REQUEST, error.details[0].message);

  const { amount, description } = value;
  const currency = process.env.MOMO_CURRENCY;

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

  // New transaction model (ledger)
  const transaction = await TransactionModel.create({
    transactionId: await TransactionModel.generateTransactionId(),
    transactionType: "Wallet Top-up",
    momoRefId: referenceId,
    bookingId: null,
    status: PaymentStatusEnum.PENDING,
    currency,
    totalAmount: Number(amount),
    description: {
      en: "Wallet Top-up",
      fr: "Rechargement du portefeuille",
    },
    platformFee: 0,
    operatorShare: 0,
    entries: [
      {
        entityType: "USER",
        entityId: userId,
        name: userExists?.fullName || null,
        type: "CREDIT",
        amount: Number(amount),
      },
      {
        // keep ledger balanced while money is pending (system hold)
        entityType: "ADMIN",
        entityId: "SYSTEM",
        name: "SYSTEM",
        type: "DEBIT",
        amount: Number(amount),
      },
    ],
    meta: {
      topup: true,
      externalId: `wallet_topup_${userId}`,
      phoneNumber,
    },
  });

  const io = getIO();
  io.to(userId.toString()).emit("payment:status", {
    transactionId: transaction.transactionId,
    status: PaymentStatusEnum.PENDING,
    message: "Awaiting MTN payment confirmation",
  });

  const outcomes = ["SUCCESS", "FAILED", "SUCCESS", "NR", "SUCCESS"];
  const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
  console.log("randomOutcome", randomOutcome);

  if (randomOutcome !== "NR") {
    setTimeout(async () => {
      try {
        await axios.post(
          `${process.env.BE_BASE_URL}/api/v1/webhook/momo-status`,
          {
            referenceId,
            status: randomOutcome,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        console.log(
          `Simulated webhook callback with status: ${randomOutcome} ${process.env.BE_BASE_URL}`
        );
      } catch (err) {
        console.error("Failed to simulate webhook:");
        if (err.response) {
          console.error("Status:", err.response.status);
          console.error("Data:", err.response.data);
        } else {
          console.error("Message:", err.message);
        }
      }
    }, 2000);
  }

  // Fallback timeout in case webhook does not arrive
  setTimeout(async () => {
    const trx = await TransactionModel.findOne({ momoRefId: referenceId });
    if (trx && trx.status === PaymentStatusEnum.PENDING) {
      trx.status = PaymentStatusEnum.FAILED;
      await trx.save();
      io.to(userId.toString()).emit("payment:status", {
        transactionId: trx.transactionId,
        amount,
        status: PaymentStatusEnum.FAILED,
        message: "Payment timed out",
      });
    }
  }, 5000);

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
  // ----------------- Step 1: Token Validation -----------------
  const authHeader = req.headers.authorization;
  const ln = (req.headers["ln"] || "en").toLowerCase();
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      translateLn(ln, "TOKEN_INVALID")
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);

  const { entity, amount, description } = req.body;
  const currency = process.env.MOMO_CURRENCY;

  if (!entity || !["busOperator", "hotelManager", "driver"].includes(entity)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "INVALID_ENTITY")
    );
  }

  // ----------------- Step 2: Resolve entity-specific details -----------------
  let userId;
  let Model;
  let phoneNumber;

  if (entity === "driver") {
    userId = decoded?.driverId; // driverId is a String
    Model = DriverBasicDetails;
    phoneNumber = decoded?.phoneNo;
  } else if (entity === "busOperator") {
    userId = decoded?._id; // ObjectId
    Model = BusOperatorModel;
    phoneNumber = decoded?.phoneNumber;
  } else if (entity === "hotelManager") {
    userId = decoded?._id; // ObjectId
    Model = HotelManagerModel;
    phoneNumber = decoded?.phoneNumber;
  }

  if (!userId || !phoneNumber) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      translateLn(ln, "TOKEN_INVALID")
    );
  }

  // ----------------- Step 3: Validate entity & wallet -----------------
  let entityExists;

  if (entity === "driver") {
    entityExists = await DriverBasicDetails.findOne({ driverId: userId });
  } else {
    entityExists = await Model.findById(userId);
  }

  if (!entityExists) {
    throw new ApiError(statusCode.NOT_FOUND, `${entity} not found`);
  }

  const wallet = await Wallet.findOne({ userId });
  if (!wallet)
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "WALLET_NOT_FOUND")
    );

  // ----------------- Step 3.1: Check withdrawable balance -----------------
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Map entity -> ledger entityType + entityId to match in entries
  let ledgerEntityType = null;
  let ledgerEntityId = null;

  if (entity === "driver") {
    ledgerEntityType = "DRIVER";
    ledgerEntityId = userId; // string
  } else if (entity === "busOperator") {
    ledgerEntityType = "BUS_OPERATOR";
    ledgerEntityId = String(userId); // store as string in entries
  } else if (entity === "hotelManager") {
    ledgerEntityType = "HOTEL";
    ledgerEntityId = String(userId); // store as string in entries
  }

  // Recent credits (last 24h) for this entity from ledger entries
  const recentCredits = await TransactionModel.aggregate([
    {
      $match: {
        status: PaymentStatusEnum.SUCCESS,
        createdAt: { $gte: cutoffTime },
      },
    },
    { $unwind: "$entries" },
    {
      $match: {
        "entries.type": TransactionTypeEnum.CREDIT,
        "entries.entityType": ledgerEntityType,
        "entries.entityId": ledgerEntityId,
      },
    },
    { $group: { _id: null, total: { $sum: "$entries.amount" } } },
  ]);

  const recentCreditAmount = recentCredits[0]?.total || 0;
  const withdrawableBalance = Math.max(wallet.balance - recentCreditAmount, 0);

  if (Number(amount) > withdrawableBalance) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      // `You can only withdraw ${withdrawableBalance} at this moment. Funds added in the last 24h are locked.`
      translateLn(ln, "WITHDRAW_LIMIT")
    );
  }

  // ----------------- Step 3.2: Minimum balance check -----------------
  if (wallet.balance - Number(amount) < 1000) {
    throw new ApiError(statusCode.BAD_REQUEST, translateLn(ln, "MIN_BALANCE"));
  }

  // ----------------- Step 4: MTN MoMo Transfer -----------------
  const referenceId = uuidv4();
  const accessToken = await getMomoToken({
    subscriptionKey: process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
    apiUser: process.env.MOMO_DISBURSEMENT_API_USER,
    apiKey: process.env.MOMO_DISBURSEMENT_API_KEY,
    env: "disbursement",
  });

  try {
    const momoResponse = await axios.post(
      `${process.env.MOMO_BASE_URL}/disbursement/v1_0/transfer`,
      {
        amount: Number(amount).toString(),
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

    if (momoResponse.status === 202) {
      // ----------------- Step 5: Record transaction (new ledger model) -----------------
      const amt = Number(amount);

      const transaction = await TransactionModel.create({
        transactionId: await TransactionModel.generateTransactionId(),
        transactionType: "Wallet Withdrawal",
        momoRefId: referenceId,
        bookingId: null,
        status: PaymentStatusEnum.SUCCESS,
        currency,
        totalAmount: amt,
        description: {
          en: `Wallet Withdrawal`,
          fr: `Retrait du portefeuille`,
        },
        platformFee: 0,
        operatorShare: 0,
        withdraw: true,
        entries: [
          {
            entityType: ledgerEntityType,
            entityId: ledgerEntityId,
            name:
              entity === "driver"
                ? entityExists?.fullName || null
                : entityExists?.fullName || entityExists?.userName || null,
            type: TransactionTypeEnum.DEBIT,
            amount: amt,
          },
          {
            entityType: "ADMIN",
            entityId: "SYSTEM",
            name: "SYSTEM",
            type: TransactionTypeEnum.CREDIT,
            amount: amt,
          },
        ],
        meta: {
          withdrawal: true,
          entity,
          entityId: ledgerEntityId,
          phoneNumber,
          externalId: `wallet_withdraw_${userId}`,
        },
      });

      // Update wallet
      wallet.balance -= amt;
      await wallet.save();

      return res.status(statusCode.OK).json(
        new ApiResponse(
          statusCode.OK,
          {
            referenceId,
            transactionId: transaction.transactionId,
            amount: amt,
            newBalance: wallet.balance,
            withdrawableBalance: withdrawableBalance - amt,
          },
          translateLn(ln, "WITHDRAW_SUCCESS")
        )
      );
    } else {
      throw new ApiError(
        statusCode.BAD_GATEWAY,
        translateLn(ln, "MOMO_FAILED")
      );
    }
  } catch (error) {
    console.error("MoMo API Error:", error.response?.data || error.message);
    throw new ApiError(
      statusCode.BAD_GATEWAY,
      error.response?.data?.message || translateLn(ln, "MOMO_FAILED")
    );
  }
});

module.exports = { requestTopay, withdrawFunds };
