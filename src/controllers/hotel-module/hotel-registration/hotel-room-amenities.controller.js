const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const HotelRoomImagesModel = require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const { uploadMultipleImagesToAws } = require("../../../utils/uploadFiles/images/uploadImages");
const { deleteImageFromAws } = require("../../../utils/uploadFiles/uploadFilestoAws");
const { uploadRoomImages } = require("../../../utils/uploadFiles/multer");
const mongoose = require("mongoose");
const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");


// const createRoom = catchAsyncError(async (req, res, next) => {
//   const { _id } = req.user;


//   const { hotelId, roomType, numberOfRoom, amenities, roomPrice } = req.body;

//   const roomImages = req.files.roomImages;

//   if (!hotelId || !roomType || !numberOfRoom) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Missing required fields.");
//   }

//   if (!roomImages || roomImages.length < 3) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Please upload at least 3 images.");
//   }

//   const hotel = await Hotel.findById(hotelId);
//   if (!hotel) {
//     throw new ApiError(statusCode.NOT_FOUND, "Hotel not found");
//   }


//   const totalExistingRooms = await individualRoomModule.countDocuments({ hotelId });
//   if (totalExistingRooms + Number(numberOfRoom) <= hotel.totalRoom) {
//     // Proceed with room creation
//     const existingRoom = await Room.findOne({ hotelId, roomType });
//     if (existingRoom) {
//       throw new ApiError(statusCode.BAD_REQUEST, "Room type already exists for this hotel.");
//     }

//     let parsedAmenities = Array.isArray(amenities) ? amenities : JSON.parse(amenities);
//     let parsedRoomPrice = parseFloat(roomPrice);

//     if (isNaN(parsedRoomPrice) || parsedRoomPrice <= 0) {
//       throw new ApiError(statusCode.BAD_REQUEST, "Invalid room price.");
//     }

//     let uploadedImages;
//     try {
//       uploadedImages = await uploadMultipleImagesToAws(roomImages);
//       console.log("Uploaded images:", uploadedImages);
//     } catch (error) {
//       throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Failed to upload images.");
//     }

//     const newRoom = await Room.create({
//       hotelId,
//       roomType,
//       numberOfRoom,
//       roomPrice: parsedRoomPrice,
//       amenities: parsedAmenities,
//     });

//     await HotelRoomImagesModel.create({
//       roomId: newRoom._id,
//       roomType,
//       images: uploadedImages,
//       uploadedBy: _id,
//     });


//     const roomWithImages = await Room.findById(newRoom._id);
//     const roomImagesData = await HotelRoomImagesModel.findOne({ roomId: newRoom._id });

//     const prefix = roomType.toLowerCase() === "standard" ? "g-" : "t-";



//     //  here create number of rooms for hotel with given type
//     const individualRooms = [];
//     for (let i = 0; i < numberOfRoom; i++) {
//       const padded = String(i+1).padStart(2, "0");
//       individualRooms.push({
//         roomTypeId: newRoom._id,
//         hotelId,
//         roomNumber: `${prefix}${padded}`,
//       })
//     }

//     const listOfRooms = await individualRoom.insertMany(individualRooms);

//     res.status(statusCode.CREATED).json(
//       new ApiResponse(statusCode.CREATED, {
//         ...roomWithImages.toObject(),
//         rooms: listOfRooms || [],
//         images: roomImagesData ? roomImagesData.images : [],
//       }, "Room added successfully.")
//     );

//   }else{
//     throw new ApiError(statusCode.BAD_REQUEST, "Total rooms exceed hotel capacity.");
//   }


// });
// const createRoom = catchAsyncError(async (req, res, next) => {
//   const { _id } = req.user;



//   const { hotelId, roomType, standardRoomCount, luxuryRoomCount, amenities, roomPrice } = req.body;
//  const totalRoomsCount = Number(standardRoomCount) + Number(luxuryRoomCount);
//  const hotelRoom = Number (hotel.totalRoom);
//  if (TotalNumberOfRooms == hotelRoom ){

//   numberOfRoom = standardRoomCount || luxuryRoomCount;



//   const roomImages = req.files.roomImages;

//   // Validate required fields
//   if (!hotelId || !roomType || !numberOfRoom) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Missing required fields.");
//   }

//   // Validate images
//   if (!roomImages || roomImages.length < 3) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Please upload at least 3 images.");
//   }

//   // Validate hotel existence
//   const hotel = await Hotel.findById(hotelId);
//   if (!hotel) {
//     throw new ApiError(statusCode.NOT_FOUND, "Hotel not found");
//   }

//   // Validate and parse number of rooms
//   const incomingRooms = Number(numberOfRoom);
//   if (isNaN(incomingRooms) || incomingRooms <= 0) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Invalid number of rooms.");
//   }

//   // Fetch existing rooms for the hotel
//   const existingRooms = await Room.find({ hotelId });

//   let totalAllocatedRooms = 0;
//   let existingStandardRooms = 0;
//   let existingLuxuryRooms = 0;

//   for (const room of existingRooms) {
//     const roomCount = Number(room.numberOfRoom); // ✅ Ensures numeric addition
//     if (room.roomType.toLowerCase() === "standard") {
//       existingStandardRooms = roomCount;
//     } else if (room.roomType.toLowerCase() === "luxury") {
//       existingLuxuryRooms = roomCount;
//     }
//     totalAllocatedRooms += roomCount;
//   }

//   const newTotal = totalAllocatedRooms + incomingRooms;

//   // Hotel room limit check
//   if (newTotal > hotel.totalRoom) {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       `Cannot create room. Hotel capacity (${hotel.totalRoom}) will be exceeded. Allocated: ${totalAllocatedRooms}, Attempted: ${incomingRooms}`
//     );
//   }

//   // If second room type is being created, ensure combined total equals hotel room count
//   if (
//     existingRooms.length === 1 &&
//     existingRooms[0].roomType.toLowerCase() !== roomType.toLowerCase()
//   ) {
//     const existingCount = Number(existingRooms[0].numberOfRoom); // ✅ Convert to number
//     const sum = existingCount + incomingRooms;

//     if (sum !== hotel.totalRoom) {
//       throw new ApiError(
//         statusCode.BAD_REQUEST,
//         `Total of Standard + Luxury rooms must equal hotel's total room count (${hotel.totalRoom}). Current total: ${sum}`
//       );
//     }
//   }

//   // Prevent duplicate roomType
//   const existingRoom = await Room.findOne({ hotelId, roomType });
//   if (existingRoom) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Room type already exists for this hotel.");
//   }

//   // Parse amenities and roomPrice
//   const parsedAmenities = Array.isArray(amenities) ? amenities : JSON.parse(amenities);
//   const parsedRoomPrice = parseFloat(roomPrice);
//   if (isNaN(parsedRoomPrice) || parsedRoomPrice <= 0) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Invalid room price.");
//   }

//   // Upload images
//   let uploadedImages;
//   try {
//     uploadedImages = await uploadMultipleImagesToAws(roomImages);
//   } catch (error) {
//     throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Failed to upload images.");
//   }

//   // Create Room Type
//   const newRoom = await Room.create({
//     hotelId,
//     roomType,
//     numberOfRoom: incomingRooms,
//     roomPrice: parsedRoomPrice,
//     amenities: parsedAmenities,
//   });

//   // Save image metadata
//   await HotelRoomImagesModel.create({
//     roomId: newRoom._id,
//     roomType,
//     images: uploadedImages,
//     uploadedBy: _id,
//   });

//   // Fetch room with image details
//   const roomWithImages = await Room.findById(newRoom._id);
//   const roomImagesData = await HotelRoomImagesModel.findOne({ roomId: newRoom._id });

//   // Create individual rooms
//   const prefix = roomType.toLowerCase() === "standard" ? "g-" : "t-";
//   const individualRooms = [];

//   for (let i = 0; i < incomingRooms; i++) {
//     const padded = String(i + 1).padStart(2, "0");
//     individualRooms.push({
//       roomTypeId: newRoom._id,
//       hotelId,
//       roomNumber: `${prefix}${padded}`,
//     });
//   }

//   const listOfRooms = await individualRoom.insertMany(individualRooms);

//   // Final response
//   res.status(statusCode.CREATED).json(
//     new ApiResponse(
//       statusCode.CREATED,
//       {
//         ...roomWithImages.toObject(),
//         rooms: listOfRooms || [],
//         images: roomImagesData ? roomImagesData.images : [],
//       },
//       "Room added successfully."
//     )
//   );
// });
const createRoom = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const {
    standardRoomCount,
    luxuryRoomCount,
    amenities,
    roomPrice
  } = req.body;
  const { hotelId, roomType } = req.query;
 
  const standardCount = Number(standardRoomCount);
  const luxuryCount = Number(luxuryRoomCount);
  if (isNaN(standardCount) || isNaN(luxuryCount)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Room counts must be valid numbers.");
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
      throw new ApiError(statusCode.BAD_REQUEST, "Standard room count must be greater than 0.");
    }
    numberOfRoom = standardCount;
  } else if (roomType.toLowerCase() === "luxury") {
    if (luxuryCount <= 0) {
      throw new ApiError(statusCode.BAD_REQUEST, "Luxury room count must be greater than 0.");
    }
    numberOfRoom = luxuryCount;
  } else {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid room type.");
  }

  const roomImages = req.files.roomImages;
  if (!roomImages || roomImages.length < 3) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please upload at least 3 images.");
  }

  const existingRoom = await Room.findOne({ hotelId, roomType });
  if (existingRoom) {
    throw new ApiError(statusCode.BAD_REQUEST, "Room type already exists for this hotel.");
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
    throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Image upload failed.");
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
  const roomImagesData = await HotelRoomImagesModel.findOne({ roomId: newRoom._id });

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
 
  if (!hotelId || !roomType) {
    return next(new ApiError(statusCode.BAD_REQUEST, "hotelId and roomType are required."));
  }
 
const room = await Room.findOne({ hotelId, roomType: roomType.toLowerCase() });
  if (!room) {
    return next(new ApiError(statusCode.NOT_FOUND, "Room not found."));
  }
 
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    return next(new ApiError(statusCode.NOT_FOUND, "Hotel not found."));
  }

  const rooms = await Room.find({ hotelId, roomType });
  // console.log(rooms);
  if (rooms.length === 0) {
    return next(new ApiError(statusCode.NOT_FOUND, "No rooms found for the specified hotel and type."));
  }

  const bookedRoomsCount = await individualRoom.countDocuments({ roomTypeId: rooms[0]._id, isAvailable: false });
  const availableRoomsCount = await individualRoom.countDocuments({ roomTypeId: rooms[0]._id, isAvailable: true });
  // const bookedRoomsCount = rooms.filter(room => room.isAvalaible).length;
  // const availableRoomsCount = rooms.length - bookedRoomsCount;

  const roomImages = await HotelRoomImagesModel.findOne({ hotelId, roomType });


  const baseRoom = rooms[0];

  res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      totalRooms: bookedRoomsCount+availableRoomsCount,
      bookedRooms: bookedRoomsCount,
      availableRooms: availableRoomsCount,
      sampleRoom: {
        ...baseRoom.toObject(),
        images: roomImages ? roomImages.images.slice(0, 3) : [],
      }
    }, "Room data fetched successfully.")
  );
});
const updateRoomByHotelAndType = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const {
    standardRoomCount,
    luxuryRoomCount,
    amenities,
    roomPrice,
  } = req.body;
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
      throw new ApiError(statusCode.BAD_REQUEST, "Standard room count must be greater than 0.");
    }
    numberOfRoom = standardCount;
  } else if (roomType?.toLowerCase() === "luxury") {
    if (luxuryCount <= 0) {
      throw new ApiError(statusCode.BAD_REQUEST, "Luxury room count must be greater than 0.");
    }
    numberOfRoom = luxuryCount;
  } else {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid room type.");
  }


  const roomImages = req.files?.roomImages;
  if (!roomImages || roomImages.length < 3) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please upload at least 3 images.");
  }


  const existingRoom = await Room.findOne({ hotelId, roomType });
  if (!existingRoom) {
    throw new ApiError(statusCode.NOT_FOUND, "Room type not found to update.");
  }

  // Validate room price
  const parsedRoomPrice = parseFloat(roomPrice);
  if (isNaN(parsedRoomPrice) || parsedRoomPrice <= 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid room price.");
  }

  // Parse amenities
  const parsedAmenities = Array.isArray(amenities)
    ? amenities
    : JSON.parse(amenities);

  // Upload new images to AWS
  let uploadedImages = [];
  try {
    uploadedImages = await uploadMultipleImagesToAws(roomImages);
  } catch (error) {
    throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Image upload failed.");
  }

  // Update existing room fields
  existingRoom.numberOfRoom = numberOfRoom;
  existingRoom.roomPrice = parsedRoomPrice;
  existingRoom.amenities = parsedAmenities;
  existingRoom.roomImages = uploadedImages; // <-- important
  await existingRoom.save();

  // Update room images in HotelRoomImagesModel
  await HotelRoomImagesModel.findOneAndUpdate(
    { roomId: existingRoom._id },
    {
      images: uploadedImages,
      uploadedBy: _id,
    },
    { new: true, upsert: true }
  );

  // Delete old individual rooms
  await individualRoom.deleteMany({ roomTypeId: existingRoom._id });

  // Create new individual rooms
  const prefix = roomType.toLowerCase() === "standard" ? "g-" : "t-";
  const individualRoomsData = Array.from({ length: numberOfRoom }, (_, i) => ({
    roomTypeId: existingRoom._id,
    hotelId,
    roomNumber: `${prefix}${String(i + 1).padStart(2, "0")}`,
  }));

  const newIndividualRooms = await individualRoom.insertMany(individualRoomsData);

 
  const roomImagesData = await HotelRoomImagesModel.findOne({ roomId: existingRoom._id });


  res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        ...existingRoom.toObject(),
        rooms: newIndividualRooms,
        images: roomImagesData?.images || [],
      },
      "Room updated successfully."
    )
  );
});





const deleteRoomByHotelAndType = catchAsyncError(async (req, res, next) => {
  const { hotelId, roomType } = req.query;

  if (!hotelId || !roomType) {
    return next(new ApiError(statusCode.BAD_REQUEST, "hotelId and roomType are required."));
  }

  const room = await Room.findOne({ hotelId, roomType });
  if (!room) {
    return next(new ApiError(statusCode.NOT_FOUND, "Room not found."));
  }
  await individualRoom.deleteMany({ roomTypeId: room._id });

  const imagesData = await HotelRoomImagesModel.findOne({ roomId: room._id });
  if (imagesData && imagesData.images.length > 0) {
    const imageKeys = imagesData.images.map(img => img.public_id);
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
  updateRoomByHotelAndType,
  deleteRoomByHotelAndType,
};
