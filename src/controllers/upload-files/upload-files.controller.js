const statusCode = require("../../utils/constants/statusCode");
const ApiResponse = require("../../utils/response/ApiResponse");
const ApiError = require("../../utils/response/ApiError");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const { uploadSingleImageToAws } = require("../../utils/uploadFiles/images/uploadImages");

const uploadImageHandler = catchAsyncError(async (req, res) => {
  const imageUploadResult = await uploadSingleImageToAws(req.files);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      imageUploadResult,
      "Image uploaded successfully"
    )
  );
});

module.exports={uploadImageHandler}
