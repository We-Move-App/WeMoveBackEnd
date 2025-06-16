const HotelImagesModel = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelModel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  uploadMultipleImagesToAws,
  uploadSingleImageToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");

// ==========================|| ADD HOTEL IMAGES ||=======================================
const addHotelImages = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { hotelId } = req.body;
  const { hotelImages } = req.files?.hotelImages ;

  if (!hotelImages || hotelImages.length < 3) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please select at least 3 images"
    );
  }

  const existingHotel = await HotelModel.findById(hotelId);
  if (!existingHotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel Not Found");
  }

  const uploadedFiles = await uploadMultipleImagesToAws(hotelImages);

  let hotelImg = await HotelImagesModel.findOne({ hotelId });

  if (hotelImg) {
    hotelImg.images.push(...uploadedFiles);
  } else {
    hotelImg = new HotelImagesModel({
      hotelId,
      images: uploadedFiles,
      uploadedBy: _id,
    });
  }

  await hotelImg.save();

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        hotelImg,
        "Hotel Images added successfully"
      )
    );
});

// ==========================|| GET HOTEL IMAGES ||=======================================
const getHotelImages = catchAsyncError(async (req, res, next) => {
  const { hotelId } = req.params;
  const findHotelImages = await HotelImagesModel.findOne({ hotelId });
  if (!findHotelImages || findHotelImages.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No images found for this hotel");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, findHotelImages, "Data found successfully")
    );
});

// ==========================|| DELETE HOTEL IMAGE ||=======================================
const deleteHotelImage = catchAsyncError(async (req, res, next) => {
  const { hotelId, imgId } = req.body;

  if (!hotelId || !imgId) {
    throw new ApiError(statusCode.BAD_REQUEST, "hotelId and imgId are required");
  }

  const findHotelImages = await HotelImagesModel.findOne({ hotelId });
  if (!findHotelImages) {
    throw new ApiError(statusCode.NOT_FOUND, "No images found for this hotel");
  }

  const imageIndex = findHotelImages.images.findIndex(
    (img) => img._id.toString() === imgId
  );
  if (imageIndex === -1) {
    throw new ApiError(statusCode.NOT_FOUND, "Image not found");
  }

  const publicId = findHotelImages.images[imageIndex].public_id;
  await deleteImageFromAws(publicId);
  findHotelImages.images.splice(imageIndex, 1);

  await findHotelImages.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        findHotelImages,
        "Image deleted successfully"
      )
    );
});

// ==========================|| UPDATE HOTEL IMAGE ||=======================================
const updateHotelImage = catchAsyncError(async (req, res, next) => {
  const { hotelId, imgId } = req.body;
  const { hotelImages } = req.files || {};

  if (!hotelId || !imgId || !hotelImages) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "hotelId, imgId, and a new image file are required"
    );
  }

  const findHotelImages = await HotelImagesModel.findOne({ hotelId });
  if (!findHotelImages) {
    throw new ApiError(statusCode.NOT_FOUND, "No images found for this hotel");
  }

  const imageIndex = findHotelImages.images.findIndex(
    (img) => img._id.toString() === imgId
  );
  if (imageIndex === -1) {
    throw new ApiError(statusCode.NOT_FOUND, "Image not found");
  }

  const oldImage = findHotelImages.images[imageIndex];
  await deleteImageFromAws(oldImage.public_id);
  const newImage = await uploadSingleImageToAws(hotelImages);

  findHotelImages.images[imageIndex] = {
    _id: imgId,
    public_id: newImage.public_id,
    url: newImage.url,
  };

  await findHotelImages.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        findHotelImages,
        "Image updated successfully"
      )
    );
});

module.exports = { addHotelImages, getHotelImages, deleteHotelImage, updateHotelImage };
