const HotelBooking = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");


const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const { deleteImageFromAws } = require("../../../utils/uploadFiles/uploadFilestoAws");
const { uploadMultipleImagesToAws } = require("../../../utils/uploadFiles/images/uploadImages");
const UserModel = require("../../../models/user-module/users/user.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");


const createBookingByHotelManager = catchAsyncError(async (req, res) => {
  const bookedBy = req.user._id;
  const {
    hotelId,
    roomTypeId,
    checkInDate,
    checkOutDate,
    totalAmount,
    paymentStatus,
    noOfAdults,
    noOfKids = 0,
    user,
  } = req.body;
const noOfRoom = parseInt(req.body.noOfRoom) || 1;
const adultsCount = parseInt(noOfAdults);
const kidsCount = parseInt(noOfKids);

  // Parse user data
  let parsedUser = {};
  try {
    parsedUser = typeof user === "string" ? JSON.parse(user) : user;
  } catch (error) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid user object format.");
  }

  // Check for required fields
  if (
    !bookedBy || !hotelId || !roomTypeId ||
    !checkInDate || !checkOutDate
  ) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing required booking details.");
  }

  // Get policy times and hotel manager validation
  const hotelPolicy = await HotelPolicyModel.findOne({ hotelId }).select("checkInTime checkOutTime");
  if (!hotelPolicy) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel policy not found.");
  }

  const userExists = await HotelManagerModel.findById(bookedBy);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel manager not found.");
  }

  const hotelExists = await Hotel.findById(hotelId);
  if (!hotelExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  // Format dates and times
  const currentDate = new Date();
  const formattedCheckIn = new Date(checkInDate);
  const formattedCheckOut = new Date(checkOutDate);

  const checkInDateTime = new Date(`${checkInDate}T${hotelPolicy.checkInTime || "12:00"}:00`);
  const checkOutDateTime = new Date(`${checkOutDate}T${hotelPolicy.checkOutTime || "11:00"}:00`);

  // Validations
  if (checkOutDateTime <= checkInDateTime) {
    throw new ApiError(statusCode.BAD_REQUEST, "Check-out must be after check-in.");
  }

  if (formattedCheckIn <= currentDate) {
    throw new ApiError(statusCode.BAD_REQUEST, "Check-in date must be in the future.");
  }

  if (formattedCheckIn >= formattedCheckOut) {
    throw new ApiError(statusCode.BAD_REQUEST, "Check-out date must be after check-in date.");
  }

  // Find all available rooms
  const allHotelRooms = await individualRoom.find({
    hotelId,
    roomTypeId,
    status: "available",
    isAvailable: true,
  });

  // Check for overlapping bookings
  const overlappingBookings = await HotelBooking.find({
    hotelId,
    checkInDate: { $lt: formattedCheckOut },
    checkOutDate: { $gt: formattedCheckIn },
    status: "Booked",
    assignedRooms: { $exists: true, $ne: [] },
  });

  const bookedRoomIds = new Set();
  overlappingBookings.forEach(booking => {
    booking.assignedRooms.forEach(roomId => {
      bookedRoomIds.add(roomId.toString());
    });
  });

  const trulyAvailableRooms = allHotelRooms.filter(
    room => !bookedRoomIds.has(room._id.toString())
  );

  if (trulyAvailableRooms.length < noOfRoom) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Only ${trulyAvailableRooms.length} rooms are available. Requested: ${noOfRoom}`
    );
  }

  // Upload identity card if exists
  let identityCard = null;
  if (req.files?.identity_card?.length > 0) {
    const uploaded = await uploadMultipleImagesToAws(req.files.identity_card);
    identityCard = {
      url: uploaded[0].url,
      key: uploaded[0].key,
      uploadedAt: new Date(),
      bookedBy,
    };
  }

  // Create booking
  const booking = await HotelBooking.create({
    bookedBy,
    roomTypeId,
    hotelId,
    checkInDate: formattedCheckIn,
    checkOutDate: formattedCheckOut,
    checkInTime: checkInDateTime,
    checkOutTime: checkOutDateTime,
    assignedRooms: [],
    totalAmount,
    paymentStatus,
    noOfAdults,
    noOfKids,
    noOfRoom,
    bookingBy: "Hotel-Manager",
    user: {
      ...parsedUser,
      identityCard,
    },
  });

  return res.status(statusCode.CREATED).json(
    new ApiResponse(statusCode.CREATED, booking, "Booking created successfully")
  );
});


const getRoomsstatus = catchAsyncError(async (req, res) => {
  const { hotelId } = req.params;
  const { startDate, endDate, status } = req.query;

  if (!hotelId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID is required.");
  }

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date(start);
  end.setHours(23, 59, 59); // Ensure full day

  // Fetch all rooms for the hotel optionally filtered by status
  const roomQuery = { hotelId };
  if (status) {
    roomQuery.status = status;
  }
  const allRooms = await individualRoom.find(roomQuery);

  // Fetch bookings overlapping with the date range
  const overlappingBookings = await HotelBooking.find({
    hotelId,
    checkInDate: { $lt: end },
    checkOutDate: { $gt: start },
    assignedRooms: { $exists: true, $ne: [] },
  });

  // Collect booked room IDs
  const bookedRoomIds = new Set();
  overlappingBookings.forEach((booking) => {
    booking.assignedRooms.forEach((roomId) => {
      bookedRoomIds.add(roomId.toString());
    });
  });

  // Filter out booked rooms
  const availableRooms = allRooms.filter((room) => !bookedRoomIds.has(room._id.toString()));

  // Group available rooms by roomTypeName
  const roomTypeMap = {};
  for (const room of availableRooms) {
    const roomType = await Room.findById(room.roomTypeId);
    if (!roomType) continue;

    const typeName = roomType.roomTypeName;
    if (!roomTypeMap[typeName]) {
      roomTypeMap[typeName] = {
        roomTypeId: room.roomTypeId,
        roomTypeName: typeName,
        count: 0,
      };
    }
    roomTypeMap[typeName].count += 1;
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, Object.values(roomTypeMap), "Filtered available rooms")
  );
});

// Get bookings with filters and pagination
// const getBookingsByHotelManager = catchAsyncError(async (req, res) => {

//   const hotelManagerId = req.user._id;
//   const hotelManager = await HotelManagerModel.findById(hotelManagerId);
//   if (!hotelManager) {
//     throw new ApiError(statusCode.NOT_FOUND, "Hotel Manager not found.");
//   }
//   const {
//     hotelId,
//     bookingId,
//     roomTypeId,
//     startDate,
//     endDate,
//     page = 1,
//     limit = 10,
//   } = req.query;

//   const query = {};

//   if (bookingId) {
//     query._id = bookingId;
//   } else if (hotelId) {
//     query.hotelId = hotelId;

//     if (startDate || endDate) {
//       query.createdAt = {};
//       if (startDate) query.createdAt.$gte = new Date(startDate);
//       if (endDate) query.createdAt.$lte = new Date(endDate);
//     }

//     if (roomTypeId) {
//       query.roomTypeId = roomTypeId;
//     }
//   } else {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       "Please provide bookingId or hotelId in query params."
//     );
//   }

//   const skip = (parseInt(page) - 1) * parseInt(limit);

//   const bookings = await HotelBooking.find(query)
//     .sort({ createdAt: -1 })
//     .skip(skip)
//     .limit(parseInt(limit))
//     .populate({ path: "hotelId", model: Hotel, select: "-__v" })
//     .populate({ path: "roomTypeId", model: Room, select: "-__v" })
//     // .populate({ path: "bookedBy", model: UserModel, select: "-password -__v" })
//     // .populate({ path: "bookedBy", model: HotelManagerModel, select: "-password -__v" })
//     .populate({ path: "assignedRooms", model: individualRoom, select: "-v" });

//   const filterBookings = bookings.filter((b) => b.bookedBy == hotelManagerId);
//   const usersBookings = bookings.filter((b) => b.bookedBy !== hotelManagerId);

//   const mappedBookings = [...filterBookings, ...usersBookings];
//   const totalBookings = await HotelBooking.countDocuments(query);
//   const totalPages = Math.ceil(totalBookings / parseInt(limit));

//   return res.status(statusCode.OK).json(
//     new ApiResponse(
//       statusCode.OK,
//       {
//         totalBookings,
//         totalPages,
//         currentPage: parseInt(page),
//         limit: parseInt(limit),
//         bookings: mappedBookings,
//       },
//       "Booking(s) fetched successfully"
//     )
//   );
// });

// by chatgpt
// const getBookingsByHotelManager = catchAsyncError(async (req, res) => {
//   const hotelManagerId = req.user._id;

//   const hotelManager = await HotelManagerModel.findById(hotelManagerId);
//   if (!hotelManager) {
//     throw new ApiError(statusCode.NOT_FOUND, "Hotel Manager not found.");
//   }

//   const {
//     hotelId,
//     bookingId,
//     roomTypeId,
//     startDate,
//     endDate,
//     page = 1,
//     limit = 10,
//   } = req.query;

//   const query = {};

//   if (bookingId) {
//     query._id = bookingId;
//   } else if (hotelId) {
//     query.hotelId = hotelId;

//     if (startDate || endDate) {
//       query.createdAt = {};
//       if (startDate) query.createdAt.$gte = new Date(startDate);
//       if (endDate) query.createdAt.$lte = new Date(endDate);
//     }

//     if (roomTypeId) {
//       query.roomTypeId = roomTypeId;
//     }
//   } else {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       "Please provide bookingId or hotelId in query params."
//     );
//   }

//   const skip = (parseInt(page) - 1) * parseInt(limit);

//   // STEP 1: Fetch all bookings without populating bookedBy
//   let bookings = await HotelBooking.find(query)
//     .sort({ createdAt: -1 })
//     .skip(skip)
//     .limit(parseInt(limit))
//     .populate({ path: "hotelId", model: Hotel, select: "-__v" })
//     .populate({ path: "roomTypeId", model: Room, select: "-__v" })
//     .populate({ path: "assignedRooms", model: individualRoom, select: "-__v" });

//   // STEP 2: Manually populate `bookedBy` for users who are NOT the hotel manager
//   const bookingsToPopulate = bookings.filter(
//     (booking) => String(booking.bookedBy) !== String(hotelManagerId)
//   );

//   const populatedUsers = await UserModel.find({
//     _id: { $in: bookingsToPopulate.map((b) => b.bookedBy) },
//   }).select("-password -__v");

//   // Map populated users to their ID for easy lookup
//   const userMap = {};
//   populatedUsers.forEach((user) => {
//     userMap[user._id.toString()] = user;
//   });

//   // STEP 3: Attach populated `bookedBy` only for user bookings
//   bookings = bookings.map((booking) => {
//     const isManagerBooking = String(booking.bookedBy) === String(hotelManagerId);
//     const bookedByUser = userMap[booking.bookedBy.toString()];
//     return {
//       ...booking.toObject(),
//       bookedBy: isManagerBooking ? booking.bookedBy : bookedByUser || booking.bookedBy,
//     };
//   });

//   const totalBookings = await HotelBooking.countDocuments(query);
//   const totalPages = Math.ceil(totalBookings / parseInt(limit));

//   return res.status(statusCode.OK).json(
//     new ApiResponse(
//       statusCode.OK,
//       {
//         totalBookings,
//         totalPages,
//         currentPage: parseInt(page),
//         limit: parseInt(limit),
//         bookings,
//       },
//       "Booking(s) fetched successfully"
//     )
//   );
// });

// const getBookingsByHotelManager = catchAsyncError(async (req, res) => {
//   const hotelManagerId = req.user._id;

//   const hotelManager = await HotelManagerModel.findById(hotelManagerId).select("-password -__v");
//   if (!hotelManager) {
//     throw new ApiError(statusCode.NOT_FOUND, "Hotel Manager not found.");
//   }

//   const {
//     hotelId,
//     bookingId,
//     roomTypeId,
//     startDate,
//     endDate,
//     page = 1,
//     limit = 10,
//   } = req.query;

//   if (!bookingId && !hotelId) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Please provide bookingId or hotelId.");
//   }

//   const query = bookingId ? { _id: bookingId } : { hotelId };
//   if (startDate || endDate) {
//     query.createdAt = {};
//     if (startDate) query.createdAt.$gte = new Date(startDate);
//     if (endDate) query.createdAt.$lte = new Date(endDate);
//   }
//   if (roomTypeId) query.roomTypeId = roomTypeId;

//   const skip = (parseInt(page) - 1) * parseInt(limit);

//   const bookings = await HotelBooking.find(query)
//     .sort({ createdAt: -1 })
//     .skip(skip)
//     .limit(parseInt(limit))
//     .populate("hotelId", "-__v")
//     .populate("roomTypeId", "-__v")
//     .populate("assignedRooms", "-__v")
//     .populate("bookedBy"); // populated using refPath (bookingBy)

//   const totalBookings = await HotelBooking.countDocuments(query);
//   const totalPages = Math.ceil(totalBookings / parseInt(limit));

//   return res.status(statusCode.OK).json(
//     new ApiResponse(
//       statusCode.OK,
//       {
//         totalBookings,
//         totalPages,
//         currentPage: parseInt(page),
//         limit: parseInt(limit),
//         bookings,
//       },
//       "Booking(s) fetched successfully"
//     )
//   );
// });


const getBookingsByHotelManager = catchAsyncError(async (req, res) => {
  const hotelManagerId = req.user._id;

  const hotelManager = await HotelManagerModel.findById(hotelManagerId);
  if (!hotelManager) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel Manager not found.");
  }

  const {
    hotelId,
    bookingId,
    roomTypeId,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = req.query;

  const query = {};

  if (bookingId) {
    query._id = bookingId;
  } else if (hotelId) {
    query.hotelId = hotelId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (roomTypeId) {
      query.roomTypeId = roomTypeId;
    }
  } else {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please provide bookingId or hotelId in query params."
    );
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Step 1: Fetch bookings WITHOUT populating bookedBy
  let bookings = await HotelBooking.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "hotelId", model: Hotel, select: "-__v" })
    .populate({ path: "roomTypeId", model: Room, select: "-__v" })
    .populate({ path: "assignedRooms", model: individualRoom, select: "-__v" });

  // Step 2: Separate manager bookings and user bookings
  // const managerBookings = bookings.filter(
  //   (b) => String(b.bookedBy) === String(hotelManagerId)
  // );
  const userBookings = bookings.filter(
    (b) => String(b.bookedBy) !== String(hotelManagerId)
  );

  // console.log("MANAGER bOOKINGS", managerBookings)
  // console.log("USER bOOKINGS", userBookings)

  // Step 3: Populate manager details
  const populatedManager = await HotelManagerModel.findById(hotelManagerId).select(
    "-password -__v"
  );
  const managerMap = {
    [hotelManagerId.toString()]: populatedManager,
  };

  // Step 4: Populate users who booked
  const userIds = userBookings.map((b) => b.bookedBy);
  const users = await UserModel.find({ _id: { $in: userIds } }).select("-password -__v");

  const userMap = {};
  users.forEach((user) => {
    userMap[user._id.toString()] = user;
  });

  // Step 5: Map final results
  const enrichedBookings = bookings.map((b) => {
    const isManager = String(b.bookedBy) === String(hotelManagerId);
    const populatedBookedBy = isManager
      ? managerMap[b.bookedBy.toString()]
      : userMap[b.bookedBy.toString()];

    return {
      ...b.toObject(),
      bookedBy: populatedBookedBy || b.bookedBy, 
    };
  });

  const totalBookings = await HotelBooking.countDocuments(query);
  const totalPages = Math.ceil(totalBookings / parseInt(limit));

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        totalBookings,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        bookings: enrichedBookings,
      },
      "Booking(s) fetched successfully"
    )
  );
});
const allotRoomToBooking = catchAsyncError(async (req, res) => {
  const { bookingId,roomId }= req.query;
  
  if (!bookingId || !roomId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Booking ID and room ID are required.");
  }

  const booking = await HotelBooking.findById(bookingId);
  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found.");
  }

  if (booking.status !== "Booked") {
    throw new ApiError(statusCode.BAD_REQUEST, `Booking is already ${booking.status}.`);
  }

  if (booking.paymentStatus !== "PAID") {
    throw new ApiError(statusCode.BAD_REQUEST, `Payment is ${booking.paymentStatus}.`);
  }

  const { hotelId, checkInDate, checkOutDate, noOfRoom, assignedRooms = [] } = booking;

  if (new Date(checkInDate) >= new Date(checkOutDate)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid check-in/check-out dates.");
  }

  if (assignedRooms.length >= noOfRoom) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Booking already has ${assignedRooms.length} assigned room(s), which meets the required ${noOfRoom}.`
    );
  }


  const room = await individualRoom.findOne({ _id: roomId, hotelId, roomTypeId: booking.roomTypeId });
  if (!room) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Room not found or does not belong to the same hotel/room type."
    );
  }
  if (room.status === "booked" || room.isAvailable === false) {
    throw new ApiError(statusCode.BAD_REQUEST, "Room is not available.");
  }

  if (assignedRooms.includes(roomId)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Room ${roomId} is already assigned to this booking.`
    );
  }


  const overlapping = await HotelBooking.findOne({
    _id: { $ne: bookingId },
    assignedRooms: roomId,
    checkInDate: { $lt: new Date(checkOutDate) },
    checkOutDate: { $gt: new Date(checkInDate) },
  });

  if (overlapping) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Room ${roomId} is already booked in the selected time period.`
    );
  }

  // ✅ Assign the room and update room fields
  booking.assignedRooms.push(roomId);
  await booking.save();

  room.isAvailable = false;
  room.status = "booked";
  room.bookingReference = booking._id;

  // You can also set time/date fields here if needed:
  const now = new Date();
  room.checkInDate = booking.checkInDate;
  room.checkOutDate = booking.checkOutDate;
  room.checkInTime = now;
  room.checkOutTime = booking.checkOutDate; // or whatever logic you want
  await room.save();

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, booking, "Room assigned successfully")
  );
});

// const cancelBooking = catchAsyncError(async (req, res) => {
//   const { bookingId } = req.query;
//   const { cancelReason, cancelledBy } = req.body;

//   if (!bookingId) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Booking ID is required.");
//   }

//   const booking = await HotelBooking.findById(bookingId);
//   if (!booking) {
//     throw new ApiError(statusCode.NOT_FOUND, "Booking not found.");
//   }

//   if (["Cancelled", "Completed"].includes(booking.status)) {
//     throw new ApiError(statusCode.BAD_REQUEST, `Booking is already ${booking.status}.`);
//   }

//   // Update booking with cancel details
//   await HotelBookings.findByIdAndUpdate(bookingId, {
//     $set: {
//       status: "Cancelled",
//       cancelledBy: cancelledBy || "Hotel-Manager",
//       cancelReason: cancelReason || "No reason provided",
//       checkOutDate: new Date(),
//       checkOutTime: new Date()
//     }
//   });

//   // Free the assigned rooms
//   await individualRoom.updateMany(
//     { bookingReference: bookingId },
//     {
//       $set: {
//         status: "available",
//         isAvailable: true,
//         bookingReference: null,
//         checkInDate: null,
//         checkOutDate: null,
//         checkInTime: null,
//         checkOutTime: null
//       }
//     }
//   );

//   return res.status(statusCode.OK).json(
//     new ApiResponse(statusCode.OK, null, "Booking cancelled successfully.")
//   );
// });


module.exports = {
  createBookingByHotelManager,
  getBookingsByHotelManager,
  getRoomsstatus,
  allotRoomToBooking,
  // cancelBooking,

};

