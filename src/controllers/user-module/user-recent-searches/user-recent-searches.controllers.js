const UserRecentSearchModel = require("../../../models/user-module/user-recent-search/user-recent-search.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const getRecentSearch = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const validTypes = ["vehicle", "bus", "hotel"];
  const type = req.query.type?.toLowerCase();

  if (!type || !validTypes.includes(type)) {
    return res.status(statusCode.BAD_REQUEST).json(
      new ApiResponse(
        statusCode.BAD_REQUEST,
        null,
        "Valid 'type' query parameter is required"
      )
    );
  }

  // Pagination
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 5, 1);
  const skip = (page - 1) * limit;

  const recentSearch = await UserRecentSearchModel.find({
    user: _id,
    category: type,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  if (!recentSearch.length) {
    return res.status(statusCode.OK).json(
      new ApiResponse(statusCode.OK, [], "No recent searches found")
    );
  }

  // Deduplicate by hotelName (case insensitive)
  let seen = new Set();
  let uniqueResults = [];

  for (const item of recentSearch) {
    let uniqueKey;

    if (type === "hotel") {
      const hotelName = item?.searchDetails?.hotel?.location?.hotelName?.toLowerCase();
      uniqueKey = hotelName; // dedupe by hotel name instead of raw address
    } else if (type === "bus") {
      uniqueKey =
        (item?.searchDetails?.bus?.from?.address || "").toLowerCase() +
        "-" +
        (item?.searchDetails?.bus?.to?.address || "").toLowerCase();
    } else if (type === "vehicle") {
      uniqueKey =
        (item?.searchDetails?.vehicle?.pickup?.address || "").toLowerCase() +
        "-" +
        (item?.searchDetails?.vehicle?.drop?.address || "").toLowerCase();
    }

    if (uniqueKey && !seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      uniqueResults.push(item); // keep full object
    }
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, uniqueResults, "Data found successfully")
  );
});

const deleteRecentSearches = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { _id: userId } = req.user;

  const deleteResult = await UserRecentSearchModel.deleteOne({
    _id: id,
    user: userId,
  });

  if (deleteResult.deletedCount === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Recent search not found");
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      deleteResult,
      "Deleted successfully"
    )
  );
});
module.exports = { getRecentSearch, deleteRecentSearches };


