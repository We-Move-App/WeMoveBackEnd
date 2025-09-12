const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  getAutoCompleteSuggestions,
} = require("../../../utils/services/maps.services");

const userGoogleSearch = catchAsyncError(async (req, res, next) => {
  const { address, index } = req.query;

  if (!address) {
    throw new ApiError(statusCode.BAD_REQUEST, "Address must be provided");
  }

  let data = await getAutoCompleteSuggestions(address);

  if (!data || data.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No searches found");
  }

  if (index !== undefined) {
    const parsedIndex = parseInt(index, 10);

    if (isNaN(parsedIndex)) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Index must be a valid number 0 to 3"
      );
    }

    data = data
      .map((item) => {
        const parts = item.split(",");
        return parts[parsedIndex]?.trim() || null;
      })
      .filter(Boolean);
  }

  return res.json(new ApiResponse(statusCode.OK, data, "Searches found"));
});

module.exports = { userGoogleSearch };
