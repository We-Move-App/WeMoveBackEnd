const mongoose = require("mongoose");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");

const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const HotelFeedbackModel = require("../../../models/hotel-module/hotel-feedback/hotel-feedback.model");

// Create or update feedback
const addFeedbackToHotel = catchAsyncError(async (req, res, next) => {
    const { hotelId, rating, comment, bookingId } = req.body;

    if (!hotelId || !rating || !bookingId) {
        return next(
            new ApiError(
                statusCode.BAD_REQUEST,
                "Hotel ID, bookingId, and rating are required"
            )
        );
    }

    const hotel = await Hotel.findById(hotelId).select("_id");
    if (!hotel) {
        return next(new ApiError(statusCode.NOT_FOUND, "Hotel not found"));
    }

    let feedback = await HotelFeedbackModel.findOne({ hotelId, bookingId });

    let message = "Feedback added successfully";

    if (feedback) {
        feedback.rating = rating;
        feedback.comment = comment;
        await feedback.save();
        message = "Feedback updated successfully";
    } else {
        feedback = await HotelFeedbackModel.create({
            hotelId,
            userId: req.user._id,
            rating,
            comment,
            bookingId,
        });
        await feedback.save();
    }

    return res
        .status(statusCode.OK)
        .json(new ApiResponse(statusCode.OK, feedback, message));
});

// Get  All feedbacks for a specific hotel.
const getHotelFeedback = catchAsyncError(async (req, res, next) => {

    const ownerId = req.user._id;
 
    const hotel = await Hotel.findOne({ownerId})


 if (!hotel) {
        return next(new ApiError(statusCode.NOT_FOUND, "Hotel Not Found"))
    }
        const filter = { hotelId: hotel.id }
       const feedbackCounts = await HotelFeedbackModel.countDocuments(filter);   

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;


        const feedbacks = await HotelFeedbackModel.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .populate("userId", "fullName email avatar")
            .populate("hotelId", "hotelName location")
            .select("rating comment createdAt updatedAt")

        return res.status(statusCode.OK).json(
            new ApiResponse(statusCode.OK, {
                feedbacks,
            
                page,
                limit,
                feedbackCounts,
            }, "Feedback fetched successfully")
        );  
    })  


// Delete a specific hotel feedback
const deleteHotelFeedback = catchAsyncError(async (req, res, next) => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(
            new ApiError(statusCode.BAD_REQUEST, "Valid feedback ID is required")
        );
    }

    const feedback = await HotelFeedbackModel.findByIdAndDelete(id);
    if (!feedback) {
        throw new ApiError(statusCode.NOT_FOUND, "Feedback not found");
    }

    return res.status(statusCode.OK).json(
        new ApiResponse(statusCode.OK, {}, "Feedback deleted successfully")
    );
});

// Get all feedbacks for hotels owned by the current user
const getAllHotelFeedback = catchAsyncError(async (req, res, next) => {
    const { _id: ownerId } = req.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    const hotels = await Hotel.find({ ownerId }).select("_id");
    if (!hotels.length) {
        return next(
            new ApiError(statusCode.NOT_FOUND, "No hotels found for this user")
        );
    }

    const hotelIds = hotels.map((hotel) => hotel._id);

    const total = await HotelFeedbackModel.countDocuments({ hotelId: { $in: hotelIds } });
    const totalPages = Math.ceil(total / limit);

    const feedbacks = await HotelFeedbackModel.find({ hotelId: { $in: hotelIds } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate("userId", "fullName email avatar")
        .populate("hotelId", "hotelName location");

    return res.status(statusCode.OK).json(
        new ApiResponse(statusCode.OK, {
            feedbacks,
            total,
            page,
            limit,
            totalPages,
            currentCount: feedbacks.length
        }, "Feedback fetched successfully")
    );
});


module.exports = {
    addFeedbackToHotel,
    getHotelFeedback,
    deleteHotelFeedback,
    getAllHotelFeedback,
};
