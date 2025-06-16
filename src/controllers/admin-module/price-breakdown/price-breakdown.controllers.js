const PriceBreakdownModel = require("../../../models/admin-module/price-breakdown/price-breakdown.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

/**
 * 🟢 Add Price Breakdown
 */
const addPricesBreakDown = catchAsyncError(async (req, res, next) => {
  const {
    serviceType,
    commissionPercent,
    taxPercent,
    discountPercent,
    pricingRules,
  } = req.body;

  // ✅ Validation: Ensure all required fields are present
  if (
    !serviceType ||
    commissionPercent === undefined ||
    taxPercent === undefined ||
    discountPercent === undefined
  ) {
    throw new ApiError(statusCode.BAD_REQUEST, "All fields are required.");
  }

  // ✅ Validate that percentages are with
  if (commissionPercent < 0 || commissionPercent > 100) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Commission percent must be between 0 and 100."
    );
  }
  if (taxPercent < 0 || taxPercent > 100) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Tax percent must be between 0 and 100."
    );
  }
  if (discountPercent < 0 || discountPercent > 100) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Discount percent must be between 0 and 100."
    );
  }

  // ✅ Check if serviceType already has a price breakdown
  const priceBreakDownExist = await PriceBreakdownModel.findOne({
    serviceType,
  });
  if (priceBreakDownExist) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Prices already set for service type: ${serviceType}`
    );
  }

  const priceBreakDown = new PriceBreakdownModel({
    serviceType,
    commissionPercent,
    taxPercent,
    discountPercent,
    pricingRules,
    createdBy: req.user._id,
  });

  await priceBreakDown.save();

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        priceBreakDown,
        "Price breakdown added successfully"
      )
    );
});

/**
 * 🟡 Update Price Breakdown
 */
const updatePricesBreakDown = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const {
    serviceType,
    commissionPercent,
    taxPercent,
    discountPercent,
    pricingRules,
  } = req.body;

  // Validate the ID
  if (!id) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Price breakdown ID is required."
    );
  }

  // Check if the price breakdown exists
  const existingPriceBreakdown = await PriceBreakdownModel.findById(id);
  if (!existingPriceBreakdown) {
    throw new ApiError(statusCode.NOT_FOUND, "Price breakdown not found.");
  }

  // Validate serviceType if provided
  if (
    serviceType &&
    !["TAXI", "BIKE", "BUS", "HOTEL"].includes(serviceType.toUpperCase())
  ) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid service type.");
  }

  // Validate percentages
  if (commissionPercent < 0 || commissionPercent > 100) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Commission percent must be between 0 and 100."
    );
  }
  if (taxPercent < 0 || taxPercent > 100) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Tax percent must be between 0 and 100."
    );
  }
  if (discountPercent < 0 || discountPercent > 100) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Discount percent must be between 0 and 100."
    );
  }

  // Validate pricingRules format
  if (pricingRules && !Array.isArray(pricingRules)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pricing rules must be an array."
    );
  }

  // Update the fields
  existingPriceBreakdown.serviceType =
    serviceType || existingPriceBreakdown.serviceType;
  existingPriceBreakdown.commissionPercent =
    commissionPercent ?? existingPriceBreakdown.commissionPercent;
  existingPriceBreakdown.taxPercent =
    taxPercent ?? existingPriceBreakdown.taxPercent;
  existingPriceBreakdown.discountPercent =
    discountPercent ?? existingPriceBreakdown.discountPercent;
  existingPriceBreakdown.pricingRules =
    pricingRules || existingPriceBreakdown.pricingRules;

  await existingPriceBreakdown.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        existingPriceBreakdown,
        "Price breakdown updated successfully."
      )
    );
});

/**
 * 🟣 Get All Price Breakdowns

*/
const getAllPricesBreakDown = catchAsyncError(async (req, res, next) => {
  const priceBreakdowns = await PriceBreakdownModel.find();

  if (!priceBreakdowns) {
    throw new ApiError(statusCode.NOT_FOUND, "Data not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        priceBreakdowns,
        "Price breakdowns retrieved successfully"
      )
    );
});
const getPricesBreakDownBySerivceType = catchAsyncError(
  async (req, res, next) => {
    let { serviceType } = req.query;

    if (!serviceType) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        `Add query subtype: taxi, bus, hotel, bike, taxi `
      );
    }

    serviceType = serviceType.toUpperCase();
    const filter = {};
    if (serviceType) filter.serviceType = serviceType;

    const priceBreakdowns = await PriceBreakdownModel.findOne(filter);
    if (!priceBreakdowns) {
      throw new ApiError(statusCode.NOT_FOUND, "Data not found");
    }

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          priceBreakdowns,
          "Price breakdowns retrieved successfully"
        )
      );
  }
);
module.exports = {
  addPricesBreakDown,
  updatePricesBreakDown,
  getPricesBreakDownBySerivceType,
  getAllPricesBreakDown,
};
