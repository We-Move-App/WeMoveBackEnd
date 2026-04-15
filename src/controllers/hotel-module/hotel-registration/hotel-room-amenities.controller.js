const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const HotelRoomImagesModel = require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const {
  uploadMultipleImagesToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const { uploadRoomImages } = require("../../../utils/uploadFiles/multer");
const mongoose = require("mongoose");
const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");

const createRoom = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { standardRoomCount, luxuryRoomCount, amenities, roomPrice } = req.body;
  const { hotelId, roomType } = req.query;

  const standardCount = Number(standardRoomCount);
  const luxuryCount = Number(luxuryRoomCount);
  if (isNaN(standardCount) || isNaN(luxuryCount)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Room counts must be valid numbers."
    );
  }
  const totalRoomsCount = standardCount + luxuryCount;
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  if (totalRoomsCount !== Number(hotel.totalRoom)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Sum of Standard and luxury rooms must match  with total rooms"
    );
  }

  let numberOfRoom;
  if (roomType.toLowerCase() === "standard") {
    if (standardCount <= 0) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Standard room count must be greater than 0."
      );
    }
    numberOfRoom = standardCount;
  } else if (roomType.toLowerCase() === "luxury") {
    if (luxuryCount <= 0) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Luxury room count must be greater than 0."
      );
    }
    numberOfRoom = luxuryCount;
  } else {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid room type.");
  }

  const roomImages = req.files.roomImages;
  if (!roomImages || roomImages.length < 3) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please upload at least 3 images."
    );
  }

  const existingRoom = await Room.findOne({ hotelId, roomType });
  if (existingRoom) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Room type already exists for this hotel."
    );
  }

  const parsedRoomPrice = parseFloat(roomPrice);
  if (isNaN(parsedRoomPrice) || parsedRoomPrice <= 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid room price.");
  }

  const parsedAmenities = Array.isArray(amenities)
    ? amenities
    : JSON.parse(amenities);

  let uploadedImages;
  try {
    uploadedImages = await uploadMultipleImagesToAws(roomImages);
  } catch (error) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Image upload failed."
    );
  }

  const newRoom = await Room.create({
    hotelId,
    roomType,
    numberOfRoom,
    roomPrice: parsedRoomPrice,
    amenities: parsedAmenities,
  });

  await HotelRoomImagesModel.create({
    roomId: newRoom._id,
    roomType,
    images: uploadedImages,
    uploadedBy: _id,
  });

  const prefix = roomType.toLowerCase() === "standard" ? "g-" : "t-";
  const individualRooms = Array.from({ length: numberOfRoom }, (_, i) => ({
    roomTypeId: newRoom._id,
    hotelId,
    roomNumber: `${prefix}${String(i + 1).padStart(2, "0")}`,
  }));

  const listOfRooms = await individualRoom.insertMany(individualRooms);

  const roomWithImages = await Room.findById(newRoom._id);
  const roomImagesData = await HotelRoomImagesModel.findOne({
    roomId: newRoom._id,
  });

  res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        ...roomWithImages.toObject(),
        rooms: listOfRooms || [],
        images: roomImagesData ? roomImagesData.images : [],
      },
      "Room added successfully."
    )
  );
});

const getRoomByHotelAndType = catchAsyncError(async (req, res, next) => {
  const { hotelId, roomType } = req.query;

  const ln = (req.headers["x-language"] || "en").toLowerCase();

  if (!hotelId || !roomType) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "hotelId and roomType are required.")
    );
  }

  const normalizedRoomType = roomType.toLowerCase();
  const mongoose = require("mongoose");

  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new ApiError(statusCode.BAD_REQUEST, "Invalid hotelId."));
  }

  const hotelObjectId = new mongoose.Types.ObjectId(hotelId);
  const room = await Room.findOne({
    hotelId: hotelObjectId,
    roomType: normalizedRoomType,
  });
  if (!room) {
    return next(new ApiError(statusCode.NOT_FOUND, "Room not found."));
  }

  const rooms = await Room.find({
    hotelId: hotelObjectId,
    roomType: normalizedRoomType,
  });
  if (rooms.length === 0) {
    return next(
      new ApiError(
        statusCode.NOT_FOUND,
        "No rooms found for the specified hotel and type."
      )
    );
  }

  const bookedRoomsCount = await individualRoom.countDocuments({
    roomTypeId: rooms[0]._id,
    isAvailable: false,
  });
  const availableRoomsCount = await individualRoom.countDocuments({
    roomTypeId: rooms[0]._id,
    isAvailable: true,
  });

  const hotelRoomTypes = await Room.find({ hotelId: hotelObjectId });
  const hotelRoomTypeIds = hotelRoomTypes.map((r) => r._id);

  const hotelBookedCount = await individualRoom.countDocuments({
    roomTypeId: { $in: hotelRoomTypeIds },
    isAvailable: false,
  });

  const hotelAvailableCount = await individualRoom.countDocuments({
    roomTypeId: { $in: hotelRoomTypeIds },
    isAvailable: true,
  });

  const roomImages = await HotelRoomImagesModel.find({
    roomId: room._id,
    roomType: normalizedRoomType,
  });
  const roomImagesData =
    roomImages.length > 0 ? roomImages[0].images.slice(0, 3) : [];

  const baseRoom = rooms[0];

  res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        totalRooms: bookedRoomsCount + availableRoomsCount,
        bookedRooms: bookedRoomsCount,
        availableRooms: availableRoomsCount,

        hotelTotalRooms: hotelBookedCount + hotelAvailableCount,
        hotelBookedRooms: hotelBookedCount,
        hotelAvailableRooms: hotelAvailableCount,

        sampleRoom: {
          ...baseRoom.toObject(),
          images: roomImagesData,
        },
      },
      "Room data fetched successfully."
    )
  );
});

const getAllRooms = catchAsyncError(async (req, res, next) => {
  const { hotelId } = req.query;

  if (!hotelId) {
    return next(new ApiError(statusCode.BAD_REQUEST, "hotelId is required."));
  }

  const mongoose = require("mongoose");
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new ApiError(statusCode.BAD_REQUEST, "Invalid hotelId."));
  }

  const hotelObjectId = new mongoose.Types.ObjectId(hotelId);

  const roomTypes = await Room.find({ hotelId: hotelObjectId });
  if (roomTypes.length === 0) {
    return next(
      new ApiError(statusCode.NOT_FOUND, "No rooms found for this hotel.")
    );
  }

  const roomTypeIds = roomTypes.map((r) => r._id);

  const hotelBookedCount = await individualRoom.countDocuments({
    roomTypeId: { $in: roomTypeIds },
    isAvailable: false,
  });
  const hotelAvailableCount = await individualRoom.countDocuments({
    roomTypeId: { $in: roomTypeIds },
    isAvailable: true,
  });

  const roomDetails = await Promise.all(
    roomTypes.map(async (room) => {
      const booked = await individualRoom.countDocuments({
        roomTypeId: room._id,
        isAvailable: false,
      });
      const available = await individualRoom.countDocuments({
        roomTypeId: room._id,
        isAvailable: true,
      });

      const roomImages = await HotelRoomImagesModel.findOne({
        roomId: room._id,
        roomType: room.roomType.toLowerCase(),
      });

      const topImages = roomImages ? roomImages.images.slice(0, 3) : [];

      return {
        roomType: room.roomType,
        numberOfRoom: room.numberOfRoom,
        roomPrice: room.roomPrice,
        amenities: room.amenities,
        bookedRooms: booked,
        availableRooms: available,
        totalRooms: booked + available,
        images: topImages,
      };
    })
  );

  // Final response
  res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        hotelTotalRooms: hotelBookedCount + hotelAvailableCount,
        hotelBookedRooms: hotelBookedCount,
        hotelAvailableRooms: hotelAvailableCount,
        roomTypes: roomDetails,
      },
      "Hotel room details fetched successfully."
    )
  );
});

const updateRoomByHotelAndType = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { standardRoomCount, luxuryRoomCount, amenities, roomPrice, imageId } =
    req.body;
  const { hotelId, roomType } = req.query;

  const standardCount = Number(standardRoomCount);
  const luxuryCount = Number(luxuryRoomCount);
  const totalRoomsCount = standardCount + luxuryCount;

  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  if (totalRoomsCount !== Number(hotel.totalRoom)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      ` Sum of Standard and luxury rooms must match  with total rooms).`
    );
  }

  let numberOfRoom;
  if (roomType?.toLowerCase() === "standard") {
    if (standardCount <= 0) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Standard room count must be greater than 0."
      );
    }
    numberOfRoom = standardCount;
  } else if (roomType?.toLowerCase() === "luxury") {
    if (luxuryCount <= 0) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Luxury room count must be greater than 0."
      );
    }
    numberOfRoom = luxuryCount;
  } else {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid room type.");
  }

  const roomImageFiles = req.files?.roomImages || [];
  let imageIdsToDelete = [];
  if (req.body.imageId) {
    try {
      imageIdsToDelete = JSON.parse(req.body.imageId);
    } catch (err) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Invalid imageId format. Must be JSON array."
      );
    }
  }

  let updatedRoomImages = [];
  let deletedRoomImages = [];
  const existingRoom = await Room.findOne({ hotelId, roomType });
  if (!existingRoom) {
    throw new ApiError(statusCode.NOT_FOUND, "Room type not found to update.");
  }

  const parsedRoomPrice = parseFloat(roomPrice);
  if (isNaN(parsedRoomPrice) || parsedRoomPrice <= 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid room price.");
  }

  const parsedAmenities = Array.isArray(amenities)
    ? amenities
    : JSON.parse(amenities);

  const roomImageDoc = await HotelRoomImagesModel.findOne({
    roomId: existingRoom._id,
  });
  if (!roomImageDoc) {
    throw new ApiError(statusCode.NOT_FOUND, "Room image document not found.");
  }

  // Delete specified images
  if (imageIdsToDelete.length > 0) {
    for (const imageId of imageIdsToDelete) {
      const imageIndex = roomImageDoc.images.findIndex(
        (img) => img._id.toString() === imageId
      );
      if (imageIndex !== -1) {
        const imgToDelete = roomImageDoc.images[imageIndex];
        await deleteImageFromAws(imgToDelete.public_id);
        roomImageDoc.images.splice(imageIndex, 1);
        deletedRoomImages.push(imgToDelete);
      }
    }
  }

  //Upload the oimages
  for (const file of roomImageFiles) {
    const uploaded = await uploadImageOnAws(file.path);
    const newImg = {
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
      fileName: file.originalname,
      fileType: file.mimetype,
    };
    roomImageDoc.images.push(newImg);
    updatedRoomImages.push(newImg);
  }

  await roomImageDoc.save();
  existingRoom.roomImages = roomImageDoc.images;

  existingRoom.numberOfRoom = numberOfRoom;
  existingRoom.roomPrice = parsedRoomPrice;
  existingRoom.amenities = parsedAmenities;
  await existingRoom.save();

  await individualRoom.deleteMany({ roomTypeId: existingRoom._id });

  const prefix = roomType.toLowerCase() === "standard" ? "g-" : "t-";
  const individualRoomsData = Array.from({ length: numberOfRoom }, (_, i) => ({
    roomTypeId: existingRoom._id,
    hotelId,
    roomNumber: `${prefix}${String(i + 1).padStart(2, "0")}`,
  }));

  const newIndividualRooms =
    await individualRoom.insertMany(individualRoomsData);

  const roomImagesData = await HotelRoomImagesModel.findOne({
    roomId: existingRoom._id,
  });

  res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      "Room updated successfully.",

      {
        ...existingRoom.toObject(),
        rooms: newIndividualRooms,
        images: roomImagesData?.images || [],
        updatedImage: updatedRoomImages,
        deletedImage: deletedRoomImages,
      }
    )
  );
});

const deleteRoomByHotelAndType = catchAsyncError(async (req, res, next) => {
  const { hotelId, roomType } = req.query;

  if (!hotelId || !roomType) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "hotelId and roomType are required.")
    );
  }

  const room = await Room.findOne({ hotelId, roomType });
  if (!room) {
    return next(new ApiError(statusCode.NOT_FOUND, "Room not found."));
  }
  await individualRoom.deleteMany({ roomTypeId: room._id });

  const imagesData = await HotelRoomImagesModel.findOne({ roomId: room._id });
  if (imagesData && imagesData.images.length > 0) {
    const imageKeys = imagesData.images.map((img) => img.public_id);
    await deleteImageFromAws(imageKeys);
    await imagesData.deleteOne();
  }
  //  before this get all rooms which have roomType ref to  room._id and delete all

  const individualRooms = await individualRoom.find({ roomTypeId: room._id });

  await room.deleteOne();

  res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      message: "Room and associated images deleted successfully.",
      deletedRoom: room,
    })
  );
});
module.exports = {
  createRoom,
  getRoomByHotelAndType,
  getAllRooms,
  updateRoomByHotelAndType,
  deleteRoomByHotelAndType,
};
