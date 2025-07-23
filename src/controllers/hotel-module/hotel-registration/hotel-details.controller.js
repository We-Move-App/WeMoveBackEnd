const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const HotelImage = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const {
  uploadMultipleImagesToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  deleteImageFromAws,
  uploadImageOnAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");

const createHotelDetails = catchAsyncError(async (req, res, next) => {
  const { hotelName, businessLicense, totalRoom, termsAndConditions, description } =
    req.body;
  const { _id } = req.user;
  const hotelImages = req.files?.hotelImages;

  if (!hotelImages || hotelImages.length < 3) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please upload at least 3 images."
    );
  }

  const user = await HotelManagerModel.findById(_id);
  if (!user) {
    throw new ApiError(statusCode.UNAUTHORIZED, "User not registered.");
  }

  if (!hotelName || !businessLicense || !totalRoom || !termsAndConditions) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing required fields.");
  }

  const isHotelNameExist = await Hotel.findOne({
    ownerId: _id,
    businessLicense,
  });
  if (isHotelNameExist) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel already exists.");
  }

  const uploadedImages = await uploadMultipleImagesToAws(hotelImages);

  const newHotel = await Hotel.create({
    hotelName,
    businessLicense,
    totalRoom,
    description,
    ownerId: _id,
    termsAndConditions,
  });

  await HotelImage.create({
    hotelId: newHotel._id,
    images: uploadedImages,
    uploadedBy: _id,
  });

  res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(statusCode.CREATED, newHotel, "Hotel added successfully.")
    );
});

const getAllHotels = catchAsyncError(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const totalHotels = await Hotel.countDocuments();
  const hotels = await Hotel.aggregate([
    {
      $lookup: {
        from: "hotelimages",
        localField: "_id",
        foreignField: "hotelId",
        as: "images",
      },
    },
    { $skip: skip },
    { $limit: parseInt(limit) },
  ]);

  if (!hotels.length) {
    throw new ApiError(statusCode.NOT_FOUND, "No hotels found.");
  }

  res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        hotels,
        totalHotels,
        totalPages: Math.ceil(totalHotels / limit),
        currentPage: parseInt(page),
      },
      "Hotels retrieved successfully"
    )
  );
});

const getHotelById = catchAsyncError(async (req, res, next) => {
  const { hotelId } = req.params;

  if (!hotelId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID is required.");
  }

  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  const images = await HotelImage.find({ hotelId });

  res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { hotel, images },
        "Hotel  retrieved."
      )
    );
});

// const updateHotelById = catchAsyncError(async (req, res) => {
//   const { hotelId } = req.params;
//   const { imageId } = req.body;

//   if (!hotelId) {
//     throw new ApiError(400, "Hotel ID is required");
//   }

//   const updatedHotel = await Hotel.findByIdAndUpdate(
//     hotelId,
//     {
//       $set: {
//         hotelName: req.body.hotelName,
//         businessLicense: req.body.businessLicense,
//         totalRoom: req.body.totalRoom,
//         termsAndConditions: req.body.termsAndConditions,
//         description: req.body.description,
//       },
//     },
//     { new: true }
//   );

//   if (!updatedHotel) {
//     throw new ApiError(404, "Hotel not found");
//   }

//   let newUploadedImage = null;
//   let deleteimages = null;
//   const newImageFile = req.files?.hotelImages?.[0];

//   if (imageId && newImageFile) {
//     const hotelImageDoc = await HotelImage.findOne({ hotelId });

//     if (!hotelImageDoc) {
//       throw new ApiError(404, "Hotel image document not found");
//     }

//     const imageIndex = hotelImageDoc.images.findIndex(
//       (img) => img._id.toString() === imageId
//     );

//     if (imageIndex === -1) {
//       throw new ApiError(404, "Image ID not found in hotel images");
//     }

//     deleteimages = await deleteImageFromAws(hotelImageDoc.images[imageIndex].public_id);
//     newUploadedImage = await uploadImageOnAws(newImageFile.path);

//     if (!newUploadedImage) {
//       throw new ApiError(500, "Failed to upload new image to AWS");
//     }

//     hotelImageDoc.images[imageIndex] = {
//       url: newUploadedImage.secure_url,
//       public_id: newUploadedImage.public_id,
//       fileName: newImageFile.originalname,
//       fileType: newImageFile.mimetype,
//     };

//     await hotelImageDoc.save();
//   }

//   res.status(200).json({
//     success: true,
//     message: "Hotel details and image updated successfully",
//     hotel: updatedHotel,
//     updatedImage: newUploadedImage,
//     deletedImage: deleteimages,
//   });
// });


const updateHotelById = catchAsyncError(async (req, res) => {
  const { hotelId } = req.params;
  const { imageId } = req.body;

  if (!hotelId) {
    throw new ApiError(400, "Hotel ID is required");
  }

  const updatedHotel = await Hotel.findByIdAndUpdate(
    hotelId,
    {
      $set: {
        hotelName: req.body.hotelName,
        businessLicense: req.body.businessLicense,
        totalRoom: req.body.totalRoom,
        termsAndConditions: req.body.termsAndConditions,
        description: req.body.description,
      },
    },
    { new: true }
  );

  if (!updatedHotel) {
    throw new ApiError(404, "Hotel not found");
  }

  let newUploadedImage = null;
  let deleteimages = null;
  const newImageFile = req.files?.hotelImages?.[0];

  if (imageId && newImageFile) {
    const hotelImageDoc = await HotelImage.findOne({ hotelId });

    if (!hotelImageDoc) {
      throw new ApiError(404, "Hotel image document not found");
    }

    const imageIndex = hotelImageDoc.images.findIndex(
      (img) => img._id.toString() === imageId
    );

    if (imageIndex === -1) {
      throw new ApiError(404, "Image ID not found in hotel images");
    }

    deleteimages = await deleteImageFromAws(hotelImageDoc.images[imageIndex].public_id);

    newUploadedImage = await uploadImageOnAws(newImageFile.path);

    if (!newUploadedImage) {
      throw new ApiError(500, "Failed to upload new image to AWS");
    }

    hotelImageDoc.images[imageIndex] = {
      url: newUploadedImage.secure_url,
      public_id: newUploadedImage.public_id,
      fileName: newImageFile.originalname,
      fileType: newImageFile.mimetype,
    };

    await hotelImageDoc.save();
  }

  const updatedHotelImages = await HotelImage.findOne({ hotelId });

  res.status(200).json({
    success: true,
    message: "Hotel details and image updated successfully",
    hotel: updatedHotel,
    updatedImage: newUploadedImage,
    deletedImage: deleteimages,
    allImages: updatedHotelImages?.images || [],
  });
});





const deleteHotelById = catchAsyncError(async (req, res, next) => {
  const { hotelId } = req.params;

  if (!hotelId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID is required.");
  }

  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  const hotelImages = await HotelImage.find({ hotelId });

  if (hotelImages.length > 0) {
    await Promise.all(
      hotelImages.map(async (imgObj) => {
        if (imgObj.images && imgObj.images.length > 0) {
          await Promise.all(
            imgObj.images.map(async (image) => {
              if (image.public_id) {
                await deleteImageFromAws(image.public_id);
              }
            })
          );
        }
      })
    );
    await HotelImage.deleteMany({ hotelId });
  }

  await Hotel.findByIdAndDelete(hotelId);

  res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        hotel,
        "Hotel and images deleted successfully"
      )
    );
});

const getHotelByToken = catchAsyncError(async (req, res, next) => {
  const id = req.user._id;


  const hotel = await Hotel.findOne({ ownerId: id });
  if (!hotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }
  const images = await HotelImage.findOne({ uploadedBy: id });

  res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { hotel, images },
        "Hotel details retrieved."
      )
    );
});

module.exports = {
  createHotelDetails,
  getAllHotels,
  getHotelById,
  updateHotelById,
  deleteHotelById,
  getHotelByToken,
};
