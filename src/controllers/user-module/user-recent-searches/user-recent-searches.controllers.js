const UserRecentSearchModel = require("../../../models/user-module/user-recent-search/user-recent-search.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const getRecentSearch = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  // Pagination
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 5, 1);
  const skip = (page - 1) * limit;

  // Normalize enum query
  const validTypes = ["vehicle", "bus", "hotel"];
  let typeQuery = null;
  if (req.query.type) {
    const lowerType = req.query.type.toLowerCase();
    typeQuery = validTypes.includes(lowerType) ? lowerType : null;
  }

  // Build query
  const query = typeQuery ? { user: _id, category: typeQuery } : { user: _id };

  // Fetch recent searches
  const recentSearch = await UserRecentSearchModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Response
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      recentSearch,
      recentSearch.length ? "Data found successfully" : "No recent searches found"
    )
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
