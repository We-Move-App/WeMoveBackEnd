// const statusCode = require("../../../utils/constants/statusCode");
// const ApiError = require("../../../utils/response/ApiError");
// const ApiResponse = require("../../../utils/response/ApiResponse");
// const catchAsyncError = require("../../../utils/response/catchAsyncError");
// const logger = require("../../../utils/logger/logger");
// const UserModel = require("../../../models/user-module/users/user.model");
// const UserDigitalWalletModel = require("../../../models/user-module/user-wallets/user-wallets.model");

// function generateRandom16DigitNumber(len) {
//   let randomNumber = "";
//   for (let i = 0; i < len; i++) {
//     randomNumber += Math.floor(Math.random() * 10);
//   }
//   return randomNumber;
// }

// const addWallet = catchAsyncError(async (req, res, next) => {
//   const { _id } = req.user;
//   const { currency = "USD" } = req.body;

//   const user = await UserModel.findById(_id);
//   if (!user) {
//     throw new ApiError(statusCode.NOT_FOUND, "User not found");
//   }

//   const findWallet = await UserDigitalWalletModel.findOne({ userId: _id });
//   if (findWallet) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Wallet already exists");
//   }

//   const cardNumber = generateRandom16DigitNumber(16);
//   if (!user.phoneNumber) {
//     throw new ApiError(statusCode.NOT_FOUND, "Phone number is not added");
//   }

//   const createWallet = new UserDigitalWalletModel({
//     cardNumber,
//     userId: _id,
//     currency: currency || "USD",
//     balance: 0,
//     walletId: user?.phoneNumber ? `${user?.phoneNumber}@wemove` : "",
//   });

//   if (!createWallet) {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       "Error occurred while creating wallet"
//     );
//   }

//   await createWallet.save();

//   return res
//     .status(statusCode.OK)
//     .json(
//       new ApiResponse(
//         statusCode.OK,
//         createWallet,
//         `Wallet created successfully`
//       )
//     );
// });

// const deleteMyWallet = catchAsyncError(async (req, res, next) => {
//   logger.info("deleting wallet...");
//   const userId = req.user._id;

//   // Check if bank details exist and delete
//   const findWallet = await UserDigitalWalletModel.findOneAndDelete({
//     userId: userId,
//   });

//   if (!findWallet) {
//     throw new ApiError(statusCode.NOT_FOUND, "Wallet not found.");
//   }
//   logger.info(`deleting wallet...  , id: ${findWallet._id}`);
//   return res
//     .status(statusCode.OK)
//     .json(new ApiResponse(statusCode.OK, {}, `Wallet deleted successfully`));
// });

// const getMyWallet = catchAsyncError(async (req, res, next) => {
//   const { _id: userId } = req.user;

//   const { walletId } = req.query;

//   const filter = walletId
//     ? { userId: userId, _id: walletId }
//     : { userId: userId };

//   // Check if bank details exist and delete
//   const findWallet = await UserDigitalWalletModel.find(filter);

//   if (!findWallet || findWallet?.length === 0) {
//     throw new ApiError(statusCode.NOT_FOUND, "Wallet not found.");
//   }

//   return res
//     .status(statusCode.OK)
//     .json(new ApiResponse(statusCode.OK, findWallet, "Wallet found"));
// });

// const searchWalletByPhoneNumber = catchAsyncError(async (req, res, next) => {
//   const { phoneNumber } = req.query;
//   if (!phoneNumber)
//     throw new ApiError(statusCode.BAD_REQUEST, "Phone number is required");

//   const user = await UserModel.findOne({ phoneNumber }).select("_id");
//   if (!user) throw new ApiError(statusCode.NOT_FOUND, "User not found");

//   const wallet = await UserDigitalWalletModel.findOne({ userId: user._id })
//     .select("_id walletId")
//     .populate("userId", "full Name phoneNumber");
//   if (!wallet) throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");

//   return res
//     .status(statusCode.OK)
//     .json(new ApiResponse(statusCode.OK, wallet, "Wallet found successfully"));
// });

// module.exports = {
//   addWallet,
//   deleteMyWallet,
//   getMyWallet,
//   searchWalletByPhoneNumber,
// };
