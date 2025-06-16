
const PriceBreakdownModel = require("../../models/admin-module/price-breakdown/price-breakdown.model");
const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");

const getFinalPrice = async (serviceType, basePrice, time = new Date()) => {
  serviceType = serviceType.toUpperCase()
  const priceRule = await PriceBreakdownModel.findOne({ serviceType });

  if (!priceRule) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Something went wrong"
    );
  }

  const result = priceRule.calculateFinalPrice(basePrice, time);
  return result;
};

module.exports = {
  getFinalPrice,
};
