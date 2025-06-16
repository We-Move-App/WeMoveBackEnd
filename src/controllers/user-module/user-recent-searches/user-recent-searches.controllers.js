const UserRecentSearchModel = require("../../../models/user-module/user-recent-search/user-recent-search.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const getRecentSearch = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const startIndex = (page - 1) * limit;
  const { type } = req.query;

  const query = type ? { user: _id, category: type } : { user: _id };

  const recentSearch = await UserRecentSearchModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  if (recentSearch?.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, `Data not found`);
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, recentSearch, `Data found Successfully`)
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
