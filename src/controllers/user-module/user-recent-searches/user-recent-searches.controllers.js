const UserRecentSearchModel = require("../../../models/user-module/user-recent-search/user-recent-search.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const getRecentSearch = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const validTypes = ["vehicle", "bus", "hotel"];
  const type = req.query.type?.toLowerCase();

  // Check if type is provided and valid
  if (!type || !validTypes.includes(type)) {
    return res.status(statusCode.BAD_REQUEST).json(
      new ApiResponse(statusCode.BAD_REQUEST, null, "Valid 'type' query parameter is required")
    );
  }

  // Pagination
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 5, 1);
  const skip = (page - 1) * limit;

  // Fetch recent searches for the user with the given type
  const recentSearch = await UserRecentSearchModel.find({ user: _id, category: type })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

 if (!recentSearch.length) {
  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, [], "No recent searches found")
  );
}


  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, recentSearch, "Data found successfully")
  );
});


const deleteRecentSearches = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { _id } = req.user;

  const deletedCount = await UserRecentSearchModel.deleteOne({
    _id: id,
    user: _id,
  });

  if (deletedCount?.deletedCount === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Not Found");
  }

  if (!deletedCount) {
    throw new ApiError(statusCode.BAD_REQUEST, "Error occurred while deleting");
  }
  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, deletedCount, "Deleted successfully"));
});

module.exports = { getRecentSearch, deleteRecentSearches };


