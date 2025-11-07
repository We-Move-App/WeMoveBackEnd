
const PriceBreakdownModel = require("../../models/admin-module/price-breakdown/price-breakdown.model");
const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const mongoose = require("mongoose");
const {
  CommissionServiceTypeEnum,
  CommissionTypeEnum,
  CommissionStatusEnum,
} = require("../../utils/constants/ENUM");

const commission = require("../../models/admin-module/commission-management/commission.model");

// const getFinalPrice = async (serviceType, basePrice, time = new Date()) => {

//   serviceType = serviceType.toUpperCase()
//   const priceRule = await commission.findOne({ serviceType });

//   if (!priceRule) {
//     throw new ApiError(
//       statusCode.INTERNAL_SERVER_ERROR,
//       "Something went wrong"
//     );
//   }

//   const result = priceRule.calculateFinalPrice(basePrice, time);
//   return result; getall
// };






// const getFinalPrice = async (serviceType, basePrice, time = new Date()) => {
//   console.log("👉 Received basePrice:", basePrice, "serviceType:", serviceType);

//   if (!basePrice || basePrice <= 0) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Invalid base price");
//   }

//   if (!serviceType) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Service type is required");
//   }

//   // ✅ Find active commission for the given service type
//   const commissionData = await commission.findOne({
//     serviceType: serviceType.toLowerCase(),
//     status: "active",
//   });

//   if (!commissionData) {
//     console.log(`⚠️ No active commission found for ${serviceType}. Returning base price.`);
//     return basePrice; // return base price if no commission
//   }

//   let finalPrice = basePrice;

//   // ✅ Apply commission
//   if (commissionData.commissionType === "percentage") {
//     if (commissionData.commissionPercentage == null) {
//       throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Commission percentage is missing");
//     }
//     const commissionAmount = (basePrice * commissionData.commissionPercentage) / 100;
//     finalPrice = basePrice + commissionAmount;
//   } else if (commissionData.commissionType === "fixed") {
//     if (commissionData.commissionRate == null) {
//       throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Commission rate is missing");
//     }
//     finalPrice = basePrice + commissionData.commissionRate;
//   } else {
//     throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Invalid commission type");
//   }

//   return finalPrice;
// };



/// final price without commmsion logic 
const getFinalPrice = async (serviceType, basePrice, time = new Date()) => {
  console.log("👉 Received basePrice:", basePrice, "serviceType:", serviceType);

  if (!basePrice || basePrice <= 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid base price");
  }

  if (!serviceType) {
    throw new ApiError(statusCode.BAD_REQUEST, "Service type is required");
  }

  // ✅ Since no commission logic is needed, just return base price
  return basePrice;
};





module.exports = { getFinalPrice };



