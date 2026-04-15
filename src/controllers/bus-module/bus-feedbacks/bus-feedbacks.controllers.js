const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusFeedbackModel = require("../../../models/bus-module/bus-feedbacks/bus-feedbacks.model");
const { fetchBusOperatorLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");

const addFeedbackToBus = catchAsyncError(async (req, res, next) => {
  const { busId, rating, comment, bookingId } = req.body;

  if (!busId || rating === undefined || !bookingId) {
    return next(
      new ApiError(
        statusCode.BAD_REQUEST,
        "Bus ID, bookingId, and rating are required"
      )
    );
  }

  if (rating < 0 || rating > 5) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "Rating must be between 0 and 5")
    );
  }

  const bus = await BusModel.findById(busId);
  if (!bus) {
    return next(new ApiError(statusCode.NOT_FOUND, "Bus not found"));
  }

  let feedback = await BusFeedbackModel.findOne({ busId, bookingId });

  let message;

  if (feedback) {
    feedback.rating = rating;
    feedback.comment = comment;
    feedback = await feedback.save();
    message = "Feedback updated successfully";
  } else {
    feedback = await BusFeedbackModel.create({
      busId,
      userId: req.user._id,
      rating,
      comment,
      bookingId,
    });
    message = "Feedback added successfully";
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, feedback, message));
});

const getBusFeedback = catchAsyncError(async (req, res, next) => {
  const { busId, bookingId } = req.params;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  let filter = {};
  if (busId) filter.busId = busId;
  if (bookingId) filter.bookingId = bookingId;

  const feedbacks = await BusFeedbackModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate("userId", "fullName email")
    .populate("busId", "busName busRegNumber");

  if (!feedbacks || feedbacks.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Feedbacks not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, feedbacks, "Feedback fetched successfully")
    );
});

const deleteFeedback = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "Feedback ID are required")
    );
  }

  const feedback = await BusFeedbackModel.findByIdAndDelete(id);
  if (!feedback) {
    throw new ApiError(statusCode.NOT_FOUND, "Feedback not found");
  }
  res
    .status(201)
    .json(new ApiResponse(statusCode.OK, {}, "Feedback deleted successfully"));
});

const getAllFeedback = catchAsyncError(async (req, res, next) => {
  const { _id: ownerId } = req.user;
  const ln = (req.headers["x-language"] || "en").toLowerCase();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const buses = await BusModel.find({ ownerId }).select("_id");

  // if (!buses.length) {
  //   return next(
  //     new ApiError(statusCode.NOT_FOUND, "No buses found for this user")
  //   );
  // }

  const busIds = buses?.map((bus) => bus._id);

  // Fetch feedback for buses owned by the user
  const feedbacks = await BusFeedbackModel.find({ busId: { $in: busIds } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate("userId", "fullName email avatar phoneNumber")
    .populate("busId", "busName busRegNumber");

  if (!feedbacks || feedbacks.length === 0) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "NO_FEEDBACK_FOUND")
    );
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        feedbacks,
        translateLn(ln, "FEEDBACK_FETCHED")
      )
    );
});

module.exports = {
  addFeedbackToBus,
  getBusFeedback,
  deleteFeedback,
  getAllFeedback,
};
