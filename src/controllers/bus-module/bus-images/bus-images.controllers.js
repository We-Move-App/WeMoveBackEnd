const BusImagesModel = require("../../../models/bus-module/bus-images/bus-images.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  uploadMultipleImagesToAws,
  uploadSingleImageToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  deleteImageFromCloudinary,
} = require("../../../utils/uploadFiles/uploadFilesToCloudinary");
const {
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");

// ==========================|| ADD BUS IMAGES||=======================================
const addBusImages = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { busId } = req.body;
  const { busImages } = req.files;

  // Validate input
  if (!busImages || busImages.length < 3) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please select at least 3 images"
    );
  }

  // Check if bus exists
  const existingBus = await BusModel.findById(busId);
  if (!existingBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus Not Found");
  }

  // Upload images to Aws
  const uploadedFiles = await uploadMultipleImagesToAws(busImages);

  // Check if bus images already exist
  let busImg = await BusImagesModel.findOne({ busId });

  if (busImg) {
    // Push new images to the existing document
    busImg.images.push(...uploadedFiles);
  } else {
    // Create a new document if not found
    busImg = new BusImagesModel({
      busId,
      images: uploadedFiles,
      uploadedBy: _id,
    });
  }

  // Save changes
  existingBus.busImages = busImg._id;
  await busImg.save();
  await existingBus.save();

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        busImg,
        "Bus Images added successfully"
      )
    );
});

// ==========================|| GET BUS IMAGES||=======================================
const getBusImages = catchAsyncError(async (req, res, next) => {
  const { busId } = req.params;

  const findBusImages = await BusImagesModel.findOne({ busId });
  if (!findBusImages || findBusImages.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No images found for this bus");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, findBusImages, "Data found successfully")
    );
});

// ==========================|| DELETE BUS IMAGE||=======================================
const deleteBusImage = catchAsyncError(async (req, res, next) => {
  const { busId, imgId } = req.body;

  if (!busId || !imgId) {
    throw new ApiError(statusCode.BAD_REQUEST, "busId and imgId are required");
  }

  const findBusImages = await BusImagesModel.findOne({ busId });
  if (!findBusImages) {
    throw new ApiError(statusCode.NOT_FOUND, "No images found for this bus");
  }

  // Find the specific image in the array
  const imageIndex = findBusImages.images.findIndex(
    (img) => img._id.toString() === imgId
  );
  if (imageIndex === -1) {
    throw new ApiError(statusCode.NOT_FOUND, "Image not found");
  }

  // Get public_id for deletion from Cloudinary
  const publicId = findBusImages.images[imageIndex].public_id;

  // Delete the image from Cloudinary
  await deleteImageFromAws(publicId);

  // Remove the image from the array
  findBusImages.images.splice(imageIndex, 1);

  // Update the database record
  await findBusImages.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        findBusImages,
        "Image deleted successfully"
      )
    );
});

// ==========================|| EDIT BUS IMAGES||=======================================
const updateBusImage = catchAsyncError(async (req, res, next) => {
  const { busId, imgId } = req.body;
  const { busImages } = req.files || {};

  // Validate request
  if (!busId || !imgId || !busImages) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "busId, imgId, and a new image file are required"
    );
  }

  // Find the bus images document
  const findBusImages = await BusImagesModel.findOne({ busId });
  if (!findBusImages) {
    throw new ApiError(statusCode.NOT_FOUND, "No images found for this bus");
  }

  // Find the specific image in the array
  const imageIndex = findBusImages.images.findIndex(
    (img) => img._id.toString() === imgId
  );
  if (imageIndex === -1) {
    throw new ApiError(statusCode.NOT_FOUND, "Image not found");
  }

  // Get old image details
  const oldImage = findBusImages.images[imageIndex];

  // Delete old image from Cloudinary
  await deleteImageFromAws(oldImage.public_id);

  // Upload new image to Cloudinary
  const newImage = await uploadSingleImageToAws(busImages);

  // Update image in the array
  findBusImages.images[imageIndex] = {
    _id: imgId,
    public_id: newImage.public_id,
    url: newImage.url,
  };

  // Save updated record
  await findBusImages.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        findBusImages,
        "Image updated successfully"
      )
    );
});

module.exports = { addBusImages, getBusImages, deleteBusImage, updateBusImage };
