const mongoose = require("mongoose");
const HotelModel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const HotelAddressModel = require("../../../models/hotel-module/hotel-registration/hotel-location.model");
const {AddressModel} = require("../../../models/global-module/address/address.model");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const logger = require("../../../utils/logger/logger"); 


const createOrUpdateLocation = catchAsyncError(async (req, res, next) => {
    const { _id } = req.user;
    const { hotelId, address, city, locality, landmark, pincode, country, state, longitude, latitude } = req.body;

    if (!hotelId || !city || !state || !country || !pincode) {
        return res.status(statusCode.BAD_REQUEST).json({
            success: false,
            message: "hotelId, city, state, country, and pincode are required"
        });
    }

    let hotelAddress = await HotelAddressModel.findOne({ hotelId });

    if (hotelAddress) {
        // 🔁 Update existing address
        const addressRecord = await AddressModel.findById(hotelAddress.address);

        if (!addressRecord) {
            throw new ApiError(statusCode.NOT_FOUND, "Address ID in HotelAddressModel not found in AddressModel.");
        }

        addressRecord.address = address || addressRecord.address;
        addressRecord.townCity = city || addressRecord.townCity;
        addressRecord.locality = locality || addressRecord.locality;
        addressRecord.landmark = landmark || addressRecord.landmark;
        addressRecord.pincode = pincode || addressRecord.pincode;
        addressRecord.country = country || addressRecord.country;
        addressRecord.state = state || addressRecord.state;

        if (longitude !== undefined && latitude !== undefined) {
            addressRecord.coordinates = { longitude, latitude };
        }

        await addressRecord.save();

        logger.info(`User ${_id} updated address for hotel ${hotelId}`);
        return res.status(statusCode.OK).json(new ApiResponse(statusCode.OK, hotelAddress, "Location updated successfully"));
    } else {
        // ➕ Insert new address
        const newAddress = new AddressModel({
            address,
            townCity: city,
            locality,
            landmark,
            pincode,
            country,
            state,
            coordinates: { longitude, latitude }
        });

        await newAddress.save();

        const newHotelAddress = new HotelAddressModel({
            hotelId,
            address: newAddress._id
        });

        await newHotelAddress.save();

        logger.info(`User ${_id} created new address for hotel ${hotelId}`);
        return res.status(statusCode.CREATED).json(new ApiResponse(statusCode.CREATED, newHotelAddress, "Location created successfully"));
    }
});


const getAddressByHotelId = catchAsyncError(async (req, res, next) => {
    const { _id } = req.user;
    const { hotelId } = req.params;

    if (!hotelId || !mongoose.Types.ObjectId.isValid(hotelId)) {
        return next(new ApiError(statusCode.BAD_REQUEST, "Invalid hotelId format"));
    }

    const hotelAddress = await HotelAddressModel.findOne({
        hotelId: new mongoose.Types.ObjectId(hotelId)
    }).populate("address");

    if (!hotelAddress) {
        return next(new ApiError(statusCode.NOT_FOUND, "No address found for this hotel"));
    }

    res.status(statusCode.OK).json(
        new ApiResponse(statusCode.OK, hotelAddress.address, "Address retrieved successfully.")
    );
});


const deleteAddressByHotelId = catchAsyncError(async (req, res, next) => {
    const { _id } = req.user;
    const { hotelId } = req.params;

    if (!hotelId || typeof hotelId !== "string") {
        return res.status(statusCode.BAD_REQUEST).json({
            success: false,
            message: "Hotel ID is required"
        });
    }

    const hotelAddress = await HotelAddressModel.findOne({ hotelId });

    if (!hotelAddress) {
        throw new ApiError(statusCode.NOT_FOUND, "No address found for this hotel.");
    }

    const addressId = hotelAddress.address;

    await HotelAddressModel.deleteOne({ hotelId });
    if (addressId) {
        await AddressModel.findByIdAndDelete(addressId);
    }

    logger.info(`User ${_id} deleted address for hotel ${hotelId}`);
    res.status(statusCode.OK).json(new ApiResponse(statusCode.OK, null, "Hotel address deleted successfully."));
});

const updateAddressByHotelId = catchAsyncError(async (req, res, next) => {
    const { address, city:townCity, locality, landmark, pincode, country, state, longitude, latitude, postalCode } = req.body;
    const { hotelId } = req.params;

    if (!hotelId || typeof hotelId !== "string") {
        return res.status(statusCode.BAD_REQUEST).json({
            success: false,
            message: "Hotel ID is required"
        });
    }

    const trimmedHotelId = hotelId.trim();

    if (!mongoose.Types.ObjectId.isValid(trimmedHotelId)) {
        return next(new ApiError(statusCode.BAD_REQUEST, "Invalid hotel ID format"));
    }

    const hotelLocation = await HotelAddressModel.findOne({ hotelId: trimmedHotelId });

    if (!hotelLocation) {
        throw new ApiError(statusCode.NOT_FOUND, "No address record found for this hotel.");
    }

    const addressRecord = await AddressModel.findById(hotelLocation.address);

    if (!addressRecord) {
        throw new ApiError(statusCode.NOT_FOUND, "No address details found.");
    }

    if (address) addressRecord.address = address;
    if (townCity) addressRecord.townCity = townCity;
    if (locality) addressRecord.locality = locality;
    if (landmark) addressRecord.landmark = landmark;
    if (pincode) addressRecord.pincode = pincode;
    if (country) addressRecord.country = country;
    if (state) addressRecord.state = state;

    if (longitude !== undefined && latitude !== undefined) {
        addressRecord.coordinates = { longitude, latitude };
    }

    if (postalCode) addressRecord.postalCode = postalCode;

    await addressRecord.save();

    logger.info(`Hotel address for hotelId ${trimmedHotelId} updated successfully.`);

    res.status(statusCode.OK).json(new ApiResponse(statusCode.OK, addressRecord, "Hotel address updated successfully."));
});

module.exports = {
    createOrUpdateLocation,
    getAddressByHotelId,
    deleteAddressByHotelId,
    updateAddressByHotelId
};
