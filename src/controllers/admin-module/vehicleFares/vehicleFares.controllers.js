const {
  VehicleFareModel,
} = require("../../../models/admin-module/vehicleFares/vehicleFares.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const getVehicleFares = catchAsyncError(async (req, res, next) => {
  const { category } = req.body;

  const fares = await VehicleFareModel.findOne({ category });

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, fares, "Fares fetched successfully"));
});

// Update or create price entry for all vehicle fares in a category
const updateVehicleFare = catchAsyncError(async (req, res) => {
  const { category, fares } = req.body;

  if (!category || !fares || typeof fares !== "object") {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Category and Fares are required"
    );
  }
  const updateQuery = {};

  if (category === "bike") {
    updateQuery["bikeFare"] = fares;
  } else if (category === "taxi") {
    updateQuery["taxiFare"] = fares;
  } else {
    return res.status(400).json({ message: "Invalid category" });
  }

  const updatedPrice = await VehicleFareModel.findOneAndUpdate(
    {},
    { $set: updateQuery },
    { new: true, upsert: true }
  );
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, updatedPrice, "Fares updated successfully")
    );
});

module.exports = {
  getVehicleFares,
  updateVehicleFare,
};
