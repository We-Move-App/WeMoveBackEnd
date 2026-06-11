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
const { translateLn } = require("../../../utils/services/translator.service");
const { fetchLn } = require("../../../utils/services/user.services");

const createAddress = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { zoneCode, area, townCity, landmark } = req.body;

  if (!zoneCode || !townCity || !area) {
    logger.warn(
      "Validation failed. Missing required fields in the request body."
    );

    const ln = await fetchLn(_id);

    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ADDRESS_REQUIRED_FIELDS")
    );
  }

  const existingAddress = await UserAddressModel.findOne({ userId: _id });
  if (existingAddress?.address) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ADDRESS_ALREADY_EXISTS")
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
        translateLn(ln, "ADDRESS_CREATED")
      )
    );
});

const getAddress = catchAsyncError(async (req, res, next) => {
  const { _id: userId } = req.user;

  const ln = await fetchLn(_id);

  const address = await UserAddressModel.findOne({ userId }).populate(
    "address"
  );
  if (!address) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "ADDRESS_NOT_FOUND")
    );
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        address,
        translateLn(ln, "ADDRESSES_FETCHED")
      )
    );
});

const updateAddress = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;
  const { zoneCode, area, townCity } = req.body;
  console.log(zoneCode, area, townCity);

  const ln = await fetchLn(userId);

  if (!zoneCode || !townCity || !area) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ADDRESS_REQUIRED_FIELDS")
    );
  }
  const userAddress = await UserAddressModel.findOne({ userId });
  if (!userAddress) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "USER_NOT_FOUND"));
  }
  const addressId = userAddress.address?._id;
  let addressToUpdate = await AddressModel.findById(addressId);
  if (!addressToUpdate) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "ADDRESS_NOT_FOUND")
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
        translateLn(ln, "ADDRESS_UPDATED")
      )
    );
});

const deleteAddress = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;

  const ln = await fetchLn(userId);

  const userAddress = await UserAddressModel.findOne({ userId });

  if (!userAddress) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "ADDRESS_NOT_FOUND")
    );
  }

  const addressId = userAddress.address?._id;

  if (!addressId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ADDRESS_ID_MISSING")
    );
  }

  // Delete Address first
  const deletedAddress = await AddressModel.findByIdAndDelete(addressId);
  if (!deletedAddress) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "ADDRESS_NOT_FOUND")
    );
  }

  // Then delete UserAddress record
  await UserAddressModel.findOneAndDelete({ userId });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, {}, translateLn(ln, "ADDRESSES_DELETED"))
    );
});

module.exports = { createAddress, getAddress, updateAddress, deleteAddress };
