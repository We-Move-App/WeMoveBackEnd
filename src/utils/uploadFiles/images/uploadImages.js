const { uploadImageOnCloudinary } = require("../uploadFilesToCloudinary");
const { uploadImageOnAws } = require("../uploadFilestoAws");
const ApiError = require("../../../utils/response/ApiError")
 const catchAsyncError = require("../../../utils/response/catchAsyncError");
 const ApiResponse = require("../../../utils/response/ApiResponse");
 const statusCode = require("../../../utils/constants/statusCode");
 
// AWS S3 IMPLEMENTATION
const uploadMultipleImagesToAws = async (files) => {
  if (!files || files.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "No files were uploaded");
  }

  const uploadedImages = [];

  for (let file of files) {
    const uploadedImage = await uploadImageOnAws(file.path);

    if (uploadedImage) {
      uploadedImages.push({
        public_id: uploadedImage.public_id,
        url: uploadedImage.secure_url,
        fileName: file.originalname,
        fileType: file.mimetype,
      });
    }
  }

  return uploadedImages;
};

const uploadSingleImageToAws = async (files) => {
  if (!files || files.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "No files were uploaded");
  }

  const file = files[0];
  if (!file.path) {
    throw new ApiError(statusCode.BAD_REQUEST, "File path is missing");
  }

  const uploadedImage = await uploadImageOnAws(file.path);

  if (!uploadedImage) {
    throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Image upload failed");
  }

  return {
    public_id: uploadedImage.public_id,
    url: uploadedImage.secure_url,
    fileName: file.originalname,
    fileType: file.mimetype,
  };
};

module.exports = {
  uploadMultipleImagesToAws,
  uploadSingleImageToAws,
};
