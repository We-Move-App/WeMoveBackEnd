const {
  AddressModel,
} = require("../../../models/global-module/address/address.model");
const {
  UserAddressModel,
} = require("../../../models/user-module/user-address/user-address.model");
const statusCode = require("../../../utils/constants/statusCode");
const logger = require("../../../utils/logger/logger");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const createAddress = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { zoneCode, area, townCity, landmark } =
    req.body;

  if (!zoneCode || !townCity || !area) {
    logger.warn(
      "Validation failed. Missing required fields in the request body."
    );
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "zoneCode, area, and townCity are required fields."
    );
  }

  const existingAddress = await UserAddressModel.findOne({ userId: _id });
  if (existingAddress?.address) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "This address already exists for the user."
    );
  }

  // Create new address document
  const newAddress = new AddressModel({
    // userId: _id,
    zoneCode,
    area,
    townCity,
    landmark,
  });

  const userAddress = new UserAddressModel({
    userId: _id,
    address: newAddress._id,
  });

  // Save the new address
  await newAddress.save();
  await userAddress.save();

  // Respond with success message and the saved address
  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        userAddress,
        "Address created successfully."
      )
    );
});

const getAddress = catchAsyncError(async (req, res, next) => {
  const { _id: userId } = req.user;

  const address = await UserAddressModel.findOne({ userId }).populate(
    "address"
  );
  if (!address) {
    throw new ApiError(statusCode.NOT_FOUND, "Address not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, address, "Addresses fetched successfully.")
    );
});

const updateAddress = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;
  const { zoneCode, area, townCity } =
    req.body;
  console.log(zoneCode, area, townCity);

  if (!zoneCode || !townCity || !area) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "zoneCode, area, and townCity are required fields."
    );
  }
  const userAddress = await UserAddressModel.findOne({ userId });
  if (!userAddress) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }
  const addressId = userAddress.address?._id;
  let addressToUpdate = await AddressModel.findById(addressId);
  if (!addressToUpdate) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Address not found for the provided user."
    );
  }
  addressToUpdate.zoneCode = zoneCode;
  addressToUpdate.area = area;
  addressToUpdate.townCity = townCity;

  await addressToUpdate.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        addressToUpdate,
        "Address updated successfully."
      )
    );
});

const deleteAddress = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;

  const userAddress = await UserAddressModel.findOne({ userId });

  if (!userAddress) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Address not found for the provided user."
    );
  }

  const addressId = userAddress.address?._id;

  if (!addressId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Address ID is missing.");
  }

  // Delete Address first
  const deletedAddress = await AddressModel.findByIdAndDelete(addressId);
  if (!deletedAddress) {
    throw new ApiError(statusCode.NOT_FOUND, "Address record not found.");
  }

  // Then delete UserAddress record
  await UserAddressModel.findOneAndDelete({ userId });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, {}, "Addresses deleted successfully.")
    );
});

module.exports = { createAddress, getAddress, updateAddress, deleteAddress };
