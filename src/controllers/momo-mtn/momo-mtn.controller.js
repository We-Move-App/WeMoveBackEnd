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

  const transaction = await Transaction.create({
    userId,
    transactionId: await Transaction.generateTransactionId(),
    momoRefId: referenceId,
    type: TransactionTypeEnum.CREDIT,
    amount,
    currency,
    description: "Wallet Top-up",
    status: PaymentStatusEnum.PENDING,
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
    }, 2000); // 2 seconds simulated delay
  }

  // Fallback timeout (350s) in case webhook does not arrive
  setTimeout(async () => {
    const trx = await Transaction.findOne({ momoRefId: referenceId });
    if (trx && trx.status === PaymentStatusEnum.PENDING) {
      trx.status = PaymentStatusEnum.FAILED;
      await trx.save();
      io.to(userId.toString()).emit("payment:status", {
        transactionId: trx.transactionId,
        amount,
        status: PaymentStatusEnum.FAILED,
        message: "Payment timed out after 350 seconds",
      });
    }
  }, 15000); // 350 seconds 350000

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
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);

  const { entity, amount, description } = req.body;
  const currency = process.env.MOMO_CURRENCY;

  if (!entity || !["busOperator", "hotelManager", "driver"].includes(entity)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid entity");
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
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
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
  if (!wallet) throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");

  // ----------------- Step 3.1: Check withdrawable balance -----------------
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let matchQuery = {
    type: TransactionTypeEnum.CREDIT,
    status: PaymentStatusEnum.SUCCESS,
    createdAt: { $gte: cutoffTime },
  };

  if (entity === "driver") {
    matchQuery.driverId = userId;
  } else if (entity === "busOperator") {
    matchQuery.busOperatorId = new mongoose.Types.ObjectId(userId);
  } else if (entity === "hotelManager") {
    matchQuery.hotelManagerId = new mongoose.Types.ObjectId(userId);
  }

  const recentCredits = await Transaction.aggregate([
    { $match: matchQuery },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const recentCreditAmount = recentCredits[0]?.total || 0;
  const withdrawableBalance = Math.max(wallet.balance - recentCreditAmount, 0);

  if (amount > withdrawableBalance) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `You can only withdraw ${withdrawableBalance} at this moment. Funds added in the last 24h are locked.`
    );
  }

  // ----------------- Step 3.2: Minimum balance check -----------------
  if (wallet.balance - amount < 1000) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "You must keep a minimum balance of 1000"
    );
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

    if (momoResponse.status === 202) {
      // ----------------- Step 5: Record transaction -----------------
      const transactionPayload = {
        transactionId: await Transaction.generateTransactionId(),
        momoRefId: referenceId,
        type: TransactionTypeEnum.DEBIT,
        amount,
        currency,
        description: description || "Withdraw via MoMo",
        status: PaymentStatusEnum.SUCCESS,
        withdraw: true,
      };

      if (entity === "driver") {
        transactionPayload.driverId = userId; // String
      } else if (entity === "busOperator") {
        transactionPayload.busOperatorId = new mongoose.Types.ObjectId(userId);
      } else if (entity === "hotelManager") {
        transactionPayload.hotelManagerId = new mongoose.Types.ObjectId(userId);
      }

      const transaction = await Transaction.create(transactionPayload);

      // Update wallet
      wallet.balance -= amount;
      await wallet.save();

      return res.status(statusCode.OK).json(
        new ApiResponse(
          statusCode.OK,
          {
            referenceId,
            transactionId: transaction.transactionId,
            amount,
            newBalance: wallet.balance,
            withdrawableBalance: withdrawableBalance - amount,
          },
          "Withdrawal processed successfully"
        )
      );
    } else {
      throw new ApiError(
        statusCode.BAD_GATEWAY,
        "Failed to initiate withdrawal with MoMo"
      );
    }
  } catch (error) {
    console.error("MoMo API Error:", error.response?.data || error.message);
    throw new ApiError(
      statusCode.BAD_GATEWAY,
      error.response?.data?.message || "Failed to process withdrawal with MoMo"
    );
  }
});

module.exports = { requestTopay, withdrawFunds };
