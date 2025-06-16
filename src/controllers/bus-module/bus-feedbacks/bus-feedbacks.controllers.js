const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusFeedbackModel = require("../../../models/bus-module/bus-feedbacks/bus-feedbacks.model");

const addFeedbackToBus = catchAsyncError(async (req, res, next) => {
  const { busId, rating, comment, bookingId } = req.body;

  if (!busId || !rating || !bookingId) {
    return next(
      new ApiError(
        statusCode.BAD_REQUEST,
        "Bus ID, bookingId, and rating are required"
      )
    );
  }

  // Validate that the bus exists
  const bus = await BusModel.findById(busId).select("_id");
  if (!bus) {
    return next(new ApiError(statusCode.NOT_FOUND, "Bus not found"));
  }

  // Check if feedback for the same bus and booking already exists
  let feedback = await BusFeedbackModel.findOne({ busId, bookingId });

  if (feedback) {
    feedback.rating = rating;
    feedback.comment = comment;
    feedback = await feedback.save();
  } else {
    feedback = await BusFeedbackModel.create({
      busId,
      userId: req.user._id,
      rating,
      comment,
      bookingId,
    });
  }

  res
    .status(201)
    .json(
      new ApiResponse(statusCode.OK, feedback, "Feedback added successfully")
    );
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
    throw new ApiError(statusCode.NOT_FOUND, "Data not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, feedbacks, "Feedback fetched successfully")
    );
});

module.exports = {
  addFeedbackToBus,
  getBusFeedback,
  deleteFeedback,
  getAllFeedback,
};
