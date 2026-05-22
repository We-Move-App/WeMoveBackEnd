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
const {
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const {
  uploadMultipleImagesToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const UserModel = require("../../../models/user-module/users/user.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const {
  PaymentStatusEnum,
  TransactionTypeEnum,
  CommissionServiceTypeEnum,
  EntityCodeEnum,
} = require("../../../utils/constants/ENUM");
const { v4: uuidv4 } = require("uuid");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const { fetchLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");

const createBookingByHotelManager = catchAsyncError(async (req, res) => {
  const bookedBy = req.user._id;
  const {
    hotelId,
    roomTypeId,
    checkInDate,
    checkOutDate,
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
  if (!bookedBy || !hotelId || !roomTypeId || !checkInDate || !checkOutDate) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Missing required booking details."
    );
  }

  // Get policy times
  const hotelPolicy = await HotelPolicyModel.findOne({ hotelId }).select(
    "checkInTime checkOutTime"
  );
  if (!hotelPolicy) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel policy not found.");
  }

  // Validate hotel manager
  const userExists = await HotelManagerModel.findById(bookedBy);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel manager not found.");
  }

  // Validate hotel
  const hotelExists = await Hotel.findById(hotelId);
  if (!hotelExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  // Format dates
  const currentDate = new Date().setHours(0, 0, 0, 0);
  const formattedCheckIn = new Date(checkInDate);
  const formattedCheckOut = new Date(checkOutDate);

  const checkInDateTime = new Date(
    `${checkInDate}T${hotelPolicy.checkInTime || "12:00"}:00`
  );
  const checkOutDateTime = new Date(
    `${checkOutDate}T${hotelPolicy.checkOutTime || "11:00"}:00`
  );

  // Validations
  if (checkOutDateTime <= checkInDateTime) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-out must be after check-in."
    );
  }

  if (formattedCheckIn <= currentDate) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-in date must be in the future."
    );
  }

  if (formattedCheckIn >= formattedCheckOut) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-out date must be after check-in date."
    );
  }

  // Calculate nights
  const nights = Math.ceil(
    (formattedCheckOut - formattedCheckIn) / (1000 * 60 * 60 * 24)
  );
  if (nights <= 0)
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Stay must be at least 1 night."
    );

  // Fetch room type price
  const roomType = await Room.findById(roomTypeId).select("roomPrice");
  if (!roomType || !roomType.roomPrice || roomType.roomPrice <= 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Invalid room type or price.");
  }

  // Calculate total amount internally
  const totalAmount = roomType.roomPrice * noOfRoom * nights;

  // Find all available rooms
  const allHotelRooms = await individualRoom.find({
    hotelId,
    roomTypeId,
    status: "available",
    isAvailable: true,
  });

  // Check overlapping bookings
  // const overlappingBookings = await HotelBooking.find({
  //   hotelId,
  //   checkInDate: { $lt: formattedCheckOut },
  //   checkOutDate: { $gt: formattedCheckIn },
  //   status: "Booked",
  //   assignedRooms: { $exists: true, $ne: [] },
  // });

  const overlappingBookings = await HotelBooking.find({
    hotelId,
    roomTypeId,
    status: "Booked",
    paymentStatus: "PAID",
    checkInDate: { $lt: formattedCheckOut },
    checkOutDate: { $gt: formattedCheckIn },
  })
    .select("noOfRoom")
    .lean();

  // const bookedRoomIds = new Set();
  // overlappingBookings.forEach(booking => {
  //   booking.assignedRooms.forEach(roomId => {
  //     bookedRoomIds.add(roomId.toString());
  //   });
  // });

  const totalBookedRooms = overlappingBookings.reduce(
    (sum, booking) => sum + (booking.noOfRoom || 0),
    0
  );

  const totalRooms = allHotelRooms.length;

  const availableRoomsCount = totalRooms - totalBookedRooms;

  if (availableRoomsCount < noOfRoom) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Only ${availableRoomsCount} rooms are available. Requested: ${noOfRoom}`
    );
  }

  // const trulyAvailableRooms = allHotelRooms.filter(
  //   room => !bookedRoomIds.has(room._id.toString())
  // );

  // if (trulyAvailableRooms.length < noOfRoom) {
  //   throw new ApiError(
  //     statusCode.BAD_REQUEST,
  //     `Only ${trulyAvailableRooms.length} rooms are available. Requested: ${noOfRoom}`
  //   );
  // }

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

  const bookingId = await generateCustomId(EntityCodeEnum.HOTEL_BOOKING, "HB");

  // Create booking
  const booking = await HotelBooking.create({
    bookingId,
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
    noOfAdults: adultsCount,
    noOfKids: kidsCount,
    noOfRoom,
    bookingBy: "Hotel-Manager",
    user: {
      ...parsedUser,
      identityCard,
    },
  });

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        booking,
        "Booking created successfully"
      )
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
  const availableRooms = allRooms.filter(
    (room) => !bookedRoomIds.has(room._id.toString())
  );

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

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        Object.values(roomTypeMap),
        "Filtered available rooms"
      )
    );
});

const getBookingsByHotelManager = catchAsyncError(async (req, res) => {
  const hotelManagerId = req.user._id;

  // ✅ Step 1: Validate manager
  const hotelManager = await HotelManagerModel.findById(hotelManagerId);
  if (!hotelManager) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel Manager not found.");
  }

  // ✅ Step 2: Get all hotels owned by this manager
  const ownedHotels = await Hotel.find({ ownerId: hotelManagerId }).select(
    "_id"
  );
  if (!ownedHotels.length) {
    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          { bookings: [] },
          "No hotels found for this manager"
        )
      );
  }
  const ownedHotelIds = ownedHotels.map((h) => h._id.toString());

  // ✅ Step 3: Build query
  const {
    bookingId,
    roomTypeId,
    checkInDate, // start date filter
    checkOutDate, // end date filter
    page = 1,
    limit = 10,
    search, // search by bookingId
  } = req.query;

  console.log("Query Params:", req.query);

  const query = { hotelId: { $in: ownedHotelIds } };

  // 🔎 Global search by bookingId
  if (search && search.trim() !== "") {
    query.bookingId = { $regex: search, $options: "i" };
  }

  // Direct bookingId filter (overrides search)
  if (bookingId) {
    query._id = bookingId;
  }

  // ✅ Check overlapping check-in / check-out
  // ✅ Check overlapping check-in / check-out
  if (checkInDate || checkOutDate) {
    const start = checkInDate ? new Date(checkInDate) : null;
    const end = checkOutDate ? new Date(checkOutDate) : null;

    // Booking overlaps the given range
    query.$and = query.$and || [];

    if (start && end) {
      query.$and.push({
        checkInDate: { $lte: end },
        checkOutDate: { $gte: start },
      });
    } else if (start) {
      query.$and.push({ checkOutDate: { $gte: start } });
    } else if (end) {
      query.$and.push({ checkInDate: { $lte: end } });
    }
  }

  // ✅ Step 4: Pagination
  const pageNumber = parseInt(page) > 0 ? parseInt(page) : 1;
  const pageSize = parseInt(limit) > 0 ? parseInt(limit) : 10;
  const skip = (pageNumber - 1) * pageSize;

  // ✅ Step 5: Fetch bookings
  let bookings = await HotelBooking.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "hotelId", model: Hotel, select: "-__v" })
    .populate({ path: "roomTypeId", model: Room, select: "-__v" })
    .populate({ path: "assignedRooms", model: individualRoom, select: "-__v" });

  // ✅ Step 6: Enrich "bookedBy" field
  const userBookings = bookings.filter(
    (b) => String(b.bookedBy) !== String(hotelManagerId)
  );

  const populatedManager =
    await HotelManagerModel.findById(hotelManagerId).select("-password -__v");
  const managerMap = { [hotelManagerId.toString()]: populatedManager };

  const userIds = userBookings.map((b) => b.bookedBy);
  const users = await UserModel.find({ _id: { $in: userIds } }).select(
    "-password -__v"
  );

  const userMap = {};
  users.forEach((user) => {
    userMap[user._id.toString()] = user;
  });

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

  // ✅ Step 7: Count total bookings
  const totalBookings = await HotelBooking.countDocuments(query);
  const totalPages = Math.ceil(totalBookings / pageSize);

  // ✅ Step 8: Response
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        totalBookings,
        totalPages,
        currentPage: pageNumber,
        limit: pageSize,
        bookings: enrichedBookings,
      },
      enrichedBookings.length
        ? "Booking(s) fetched successfully"
        : "No bookings found"
    )
  );
});

const allotRoomToBooking = catchAsyncError(async (req, res) => {
  const { bookingId, roomId } = req.query;
  const ln = (req.headers["ln"] || "en").toLowerCase();
  if (!bookingId || !roomId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "BOOKING_ID_AND_ROOM_ID_REQUIRED")
    );
  }

  const bookingDoc = await HotelBooking.findOne({ bookingId });
  if (!bookingDoc) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKING_NOT_FOUND")
    );
  }

  const bookingObjectId = bookingDoc._id;

  // Now you can use bookingObjectId anywhere you need ObjectId
  const booking = await HotelBooking.findById(bookingObjectId);

  if (booking.status !== "Booked") {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Booking is already ${booking.status}.`
    );
  }

  if (booking.paymentStatus !== "PAID") {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Payment is ${booking.paymentStatus}.`
    );
  }

  const {
    hotelId,
    checkInDate,
    checkOutDate,
    noOfRoom,
    assignedRooms = [],
  } = booking;

  if (new Date(checkInDate) >= new Date(checkOutDate)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Invalid check-in/check-out dates."
    );
  }

  if (assignedRooms.length >= noOfRoom) {
    const message =
      ln === "fr"
        ? `La réservation a déjà ${assignedRooms.length} chambre(s) attribuée(s), ce qui correspond au nombre requis de ${noOfRoom}.`
        : `Booking already has ${assignedRooms.length} assigned room(s), which meets the required ${noOfRoom}.`;

    throw new ApiError(statusCode.BAD_REQUEST, message);
  }
  const room = await individualRoom.findOne({
    _id: roomId,
    hotelId,
    roomTypeId: booking.roomTypeId,
  });
  if (!room) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "ROOM_NOT_FOUND_OR_INVALID")
    );
  }

  if (room.status === "booked" || room.isAvailable === false) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ROOM_NOT_AVAILABLE")
    );
  }

  if (assignedRooms.includes(roomId)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ROOM_ALREADY_ASSIGNED", {
        roomId,
      })
    );
  }

  const overlapping = await HotelBooking.findOne({
    _id: { $ne: bookingObjectId }, // ✅ use ObjectId here
    assignedRooms: roomId,
    checkInDate: { $lt: new Date(checkOutDate) },
    checkOutDate: { $gt: new Date(checkInDate) },
  });

  if (overlapping) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ROOM_ALREADY_BOOKED_FOR_PERIOD", {
        roomId,
      })
    );
  }

  // ✅ Assign room
  booking.assignedRooms.push(roomId);
  await booking.save();

  room.isAvailable = false;
  room.status = "booked";
  room.bookingReference = booking._id;

  room.checkInDate = booking.checkInDate;
  room.checkOutDate = booking.checkOutDate;
  room.checkInTime = new Date();
  room.checkOutTime = booking.checkOutDate;
  await room.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        booking,
        translateLn(ln, "ROOM_ASSIGNED_SUCCESSFULLY")
      )
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
