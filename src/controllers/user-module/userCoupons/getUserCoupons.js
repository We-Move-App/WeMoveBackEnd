const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const {
  CouponModel,
} = require("../../../models/admin-module/Admin-coupon/adminCouponModel");
const { fetchLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");

const getAllCoupons = catchAsyncError(async (req, res) => {
  const userId = req.user?._id;

  const ln = await fetchLn(userId);

  const currentDate = new Date();
  console.log("Current Date:", currentDate);

  // ✅ Fetch only valid coupons
  const coupons = await CouponModel.find({
    status: "Active",
    startDate: { $lte: currentDate },
    expiryDate: { $gte: currentDate },
    $expr: { $lt: ["$usedCount", "$maxUsage"] }, // ensure not overused
  });
  // Check if any coupons found
  if (!coupons || coupons.length === 0) {
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: translateLn(ln, "NO_COUPONS_AVAILABLE"),
      data: [],
    });
  }

  // Step 1: Format coupons
  const formattedCoupons = coupons.map((coupon) => {
    let header = coupon.header || "";
    let discountText = "";

    if (coupon.discountType === "Percentage") {
      discountText = `${coupon.discountPercentage}% off`;
    } else if (coupon.discountType === "Fixed Amount") {
      discountText = `Flat ₹${coupon.discountAmount} off`;
    }

    return {
      couponId: coupon._id,
      header,
      tilte: discountText,
      couponCode: coupon.couponCode,
      description: `${translateLn(ln, "USE")} ${coupon.couponCode} ${translateLn(ln, "ON_ORDER_ABOVE")} ${coupon.minOrderAmount}`,
    };
  });

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Valid Coupons fetched successfully",
    data: formattedCoupons,
  });
});

module.exports = { getAllCoupons };
