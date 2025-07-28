const HotelBooking = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");
const User = require("../../../models/user-module/users/user.model");
const HotelAddressModel = require("../../../models/hotel-module/hotel-registration/hotel-location.model");
const { AddressModel } = require("../../../models/global-module/address/address.model");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const UserModel = require("../../../models/user-module/users/user.model");
const { PaymentStatus } = require("../../../utils/constants/constants");
const ValidateSecurePin = require("../../../utils/services/securePin.services");
const individualRoomModule = require("../../../models/hotel-module/single-room/individual-room.module");
const hotelImagesModel = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelFeedbackModel = require("../../../models/hotel-module/hotel-feedback/hotel-feedback.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const HotelRoomImagesModel = require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");



//-------------------- create booking --------------------
const createBooking = catchAsyncError(async (req, res) => {
  const bookedBy = req.user._id;
  const {
    hotelId,
    roomTypeId,
    checkInDate,
    checkOutDate,
    checkInTime,
    checkOutTime,
    totalAmount,
    paymentStatus,
    noOfAdults,
    noOfKids,
    noOfRoom,
    user,
  } = req.body;
  // Format dates and times
  const currentDate = new Date();
  const formattedCheckIn = new Date(checkInDate);
  const formattedCheckOut = new Date(checkOutDate);

  const checkInDateTime = new Date(`${checkInDate}T${HotelPolicyModel.checkInTime || "12:00"}:00`);
  const checkOutDateTime = new Date(`${checkOutDate}T${HotelPolicyModel.checkOutTime || "11:00"}:00`);
  if (
    !bookedBy || !hotelId || !checkInDate || !checkOutDate ||
    !noOfRoom || !roomTypeId
  ) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing required booking details.");
  }


  // Check if user exists
  const userExists = await User.findById(bookedBy);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "User not registered.");
  }

  // Check if hotel exists
  const hotelExists = await Hotel.findById(hotelId);
  if (!hotelExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }



  // Find all rooms of this hotel
  const allHotelRooms = await individualRoom.find({
    hotelId,
    status: "available",
    isAvailable: true,
    roomTypeId
  });

  // Get all overlapping bookings for the requested date range
  const overlappingBookings = await HotelBooking.find({
    hotelId,
    checkInDate: { $lt: formattedCheckOut },
    checkOutDate: { $gt: formattedCheckIn },
    status: { $in: ["Booked"] },
    assignedRooms: { $exists: true, $ne: [] },
  });


  // Collect all room IDs that are already booked in overlapping bookings
  const bookedRoomIds = new Set();
  overlappingBookings.forEach((booking) => {
    booking.assignedRooms.forEach((roomId) => {
      bookedRoomIds.add(roomId.toString());
    });
  });

  // Filter available rooms excluding those already booked for the given time
  const trulyAvailableRooms = allHotelRooms.filter(
    (room) => !bookedRoomIds.has(room._id.toString())
  );

  if (trulyAvailableRooms.length < noOfRoom) {

    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Only ${trulyAvailableRooms.length} rooms are available during your selected time. Requested: ${noOfRoom}`
    );
  }
  const booking = await HotelBooking.create({
    bookedBy,
    roomTypeId,
    hotelId,
    checkInDate: formattedCheckIn,
    checkOutDate: formattedCheckOut,
    assignedRooms: [],
    checkInTime: checkInDateTime,
    checkOutTime: checkOutDateTime,
    totalAmount,
    paymentStatus,
    noOfAdults,
    noOfKids,
    noOfRoom,
    user,
  });
  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      booking,
      "Booking created successfully"
    )
  );
});

const payHotelBookingPayment = catchAsyncError(async (req, res, next) => {
  const { securePin } = req.body;

  const { bookingId } = req.params;

  await ValidateSecurePin({
    req,
    securePin,
  });

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Payment Successfully Done"));
});

const getBookings = catchAsyncError(async (req, res) => {

  const {
    bookingId,
    hotelId,
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

    if (userId) {
      query.bookedBy = userId;
    }

  } else {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please provide bookingId or hotelId in query params."
    );
  }


  const skip = (parseInt(page) - 1) * parseInt(limit);


  const bookings = await HotelBooking.find(query)

    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "hotelId", model: Hotel, select: "-__v" })
    .populate({ path: "roomTypeId", model: Room, select: "-__v" })
    .populate({ path: "bookedBy", model: User, select: "-password -__v" })
    .populate({ path: "assignedRooms", model: individualRoom, select: "-__v" });

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
        bookings,
      },
      "Booking(s) fetched successfully"
    )
  );
});



const getHotelsByLocation = catchAsyncError(async (req, res) => {
  const { townCity, requiredRooms, checkInDate, checkOutDate, page = 1, limit = 10 } = req.query;

  const requiredRoomCount = parseInt(requiredRooms);
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  if( isNaN(requiredRoomCount) || requiredRoomCount <= 0 ){
    throw new ApiError(statusCode.BAD_REQUEST, "requiredRooms must be a positive integer.");
  }
 
if( !requiredRoomCount ){
    throw new ApiError(statusCode.BAD_REQUEST, "requiredRooms is required.");
  }
  if (!townCity || typeof townCity !== "string") {
    throw new ApiError(statusCode.BAD_REQUEST, "townCity is required.");
  }

  if (!checkInDate || !checkOutDate) {
    throw new ApiError(statusCode.BAD_REQUEST, "checkInDate and checkOutDate are required.");
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (checkOut <= checkIn) {
    throw new ApiError(statusCode.BAD_REQUEST, "checkOutDate must be after checkInDate.");
  }

  const matchingAddresses = await AddressModel
    .find({ townCity: { $regex: townCity, $options: "i" } })
    .select("_id")
    .lean();

  if (matchingAddresses.length === 0) {
    return res.status(statusCode.OK).json(
      new ApiResponse(statusCode.OK, { total: 0, page: pageNum, limit: limitNum, hotelRoomTypeLayout: [] }, "No address found for this location.")
    );
  }

  const addressIds = matchingAddresses.map(addr => addr._id);

  const hotelAddressLinks = await HotelAddressModel
    .find({ address: { $in: addressIds } })
    .select("hotelId")
    .lean();

  const hotelIds = hotelAddressLinks.map(link => link.hotelId);

  if (hotelIds.length === 0) {
    return res.status(statusCode.OK).json(
      new ApiResponse(statusCode.OK, { total: 0, page: pageNum, limit: limitNum, hotelRoomTypeLayout: [] }, "No hotels found for this location.")
    );
  }

  const hotels = await Hotel.find({ _id: { $in: hotelIds } })
    .select("hotelName rating  totalRoom")
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();

  const hotelRoomTypeLayout = await Promise.all(
    hotels.map(async (hotel) => {
      const [roomTypes, hotelImages, hotelAddress, hotelPolicies, HotelFeedbacks,] = await Promise.all([
        Room.find({ hotelId: hotel._id }).select("roomType roomPrice numberOfRoom").lean(),
        hotelImagesModel.findOne({ hotelId: hotel._id }).select("images").lean(),
        HotelAddressModel.findOne({ hotelId: hotel._id })
          .populate("address", "townCity address landmark")
          .select("address")
          .lean(),
        HotelPolicyModel.findOne({ hotelId: hotel._id }).select("amenities checkInTime checkOutTime ").lean(),
        HotelFeedbackModel.find({ hotelId: hotel._id }).select("rating").lean()
      ]);

      const selectedImage = hotelImages?.images?.[0] || null;
      const filteredRoomTypes = await Promise.all(
        roomTypes.map(async (roomType) => {
          const rooms = await individualRoomModule.find({
            hotelId: hotel._id,
            roomTypeId: roomType._id
          }).select("_id").lean();

          const roomIds = rooms.map(r => r._id);

          const conflictingBookings = await HotelBooking.find({
            roomId: { $in: roomIds },
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn }
          }).select("roomId").lean();

          const bookedRoomIds = new Set(conflictingBookings.map(b => b.roomId.toString()));
          const availableRooms = roomIds.filter(id => !bookedRoomIds.has(id.toString())).length;

          if (availableRooms >= requiredRoomCount) {
            return {
              _id: roomType._id,
              roomType: roomType.roomType,
              numberOfRoom: roomType.numberOfRoom,
              roomPrice: roomType.roomPrice,
              availableRooms
            };
          } else {
            return null;
          }
        })
      );

      const availableRoomTypes = filteredRoomTypes.filter(Boolean);

      if (availableRoomTypes.length > 0) {
        return {
          hotel: {

            hotelId: hotel._id,
            hotelName: hotel.hotelName,
            rating: hotel.rating,
            totalRoom: hotel.totalRoom,

          },
          hotelImage: selectedImage,
          hotelAddress,
          hotelPolicies,
          hotelFeedbacks: HotelFeedbacks,
          roomTypes: availableRoomTypes
        };
      }

      return null;
    })
  );

  const filteredHotels = hotelRoomTypeLayout.filter(Boolean);
  

const responseMessage = filteredHotels.length === 0 ? "No room found" : "Hotels retrieved successfully.";

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      total: filteredHotels.length,
      page: pageNum,
      limit: limitNum,
      hotelRoomTypeLayout: filteredHotels
    }, responseMessage)
  );
});
//-------------------- get hotel by id --------------------
const getHotelById = catchAsyncError(async (req, res) => {
  const { hotelId } = req.params;

  if (!hotelId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID is required.");
  }

  // Get basic hotel info
  const hotel = await Hotel.findById(hotelId)
    .select("hotelName rating totalRoom")
    .lean();

  if (!hotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  // Get related data
  const [hotelImages, hotelAddress, hotelPolicies, hotelFeedbacks, roomTypes] = await Promise.all([
    hotelImagesModel.findOne({ hotelId }).select("images").lean(),
    HotelAddressModel.findOne({ hotelId })
      .populate("address", "townCity address landmark")
      .select("address")
      .lean(),
    HotelPolicyModel.findOne({ hotelId }).select("amenities checkInTime checkOutTime").lean(),
    HotelFeedbackModel.find({ hotelId }).select("rating").lean(),
    Room.find({ hotelId }).select("roomType roomPrice numberOfRoom").lean()
  ]);
  const allHotelImages = hotelImages?.images || [];

  const roomTypesWithImages = await Promise.all(
    roomTypes.map(async (room) => {
      const roomImageData = await HotelRoomImagesModel.findOne({
        roomId: room._id,
        roomType: room.roomType
      }).select("images").lean();

      const allImages = roomImageData?.images || [];

      return {
        _id: room._id,
        roomType: room.roomType,
        roomPrice: room.roomPrice,
        numberOfRoom: room.numberOfRoom,
        images: allImages // ✅ ALL images for room type
      };
    })
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      hotel: {
        hotelId,
        hotelName: hotel.hotelName,
        rating: hotel.rating,
        totalRoom: hotel.totalRoom
      },
      hotelImages: allHotelImages, // ✅ return array
      hotelAddress,
      hotelPolicies,
      hotelFeedbacks,
      roomTypes: roomTypesWithImages // ✅ each room has full images array
    }, "Hotel details fetched successfully.")
  );
});

const getUpcomingBookings = catchAsyncError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query = {
    bookedBy: userId,
    checkInDate: { $gte: today },
    status: "Booked",
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await HotelBooking.find(query)
    .sort({ checkInDate: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: "hotelId",
      model: Hotel,
      select: "-__v -createdAt -updatedAt"
    })
    .populate({
      path: "roomTypeId",
      model: Room,
      select: "-__v -roomDescription"
    })
    .populate({
      path: "bookedBy",
      model: User,
      select: "-__v -password -email -phone"
    })
    .populate({
      path: "assignedRooms",
      model: individualRoom,
      select: "-__v -roomStatus"
    })
    .lean();

  const bookingsWithExtras = await Promise.all(
    bookings.map(async (booking) => {
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      const now = new Date();
      const diffMs = checkIn - now;
      const hoursLeft = diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60)) : 0;
      const isCancellable = hoursLeft >= 24;

      // ✅ Fetch hotel images
      const hotelImages = await hotelImagesModel
        .findOne({ hotelId: booking.hotelId._id })
        .select("images")
        .lean();
      const hotelImage = hotelImages?.images || [];

      return {
        ...booking,
        nights,
        hotelImage,
        isCancellable, 
        hoursLeftUntilCheckIn: hoursLeft,
      };
    })
  );

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
        bookings: bookingsWithExtras,
      },
      "Upcoming bookings fetched successfully"
    )
  );
});
const getPastBookings = catchAsyncError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query = {
    bookedBy: userId,
    checkInDate: { $lt: today }
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await HotelBooking.find(query)
    .sort({ checkInDate: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "hotelId", model: Hotel, select: "-__v" })
    .populate({ path: "roomTypeId", model: Room, select: "-__v" })
    .populate({ path: "bookedBy", model: User, select: "-password -__v" })
    .populate({ path: "assignedRooms", model: individualRoom, select: "-__v" })
    .lean(); // Allow editing results

  const bookingsWithExtras = await Promise.all(
    bookings.map(async (booking) => {
      // Calculate number of nights
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      // Get hotel images
      const hotelImages = await hotelImagesModel.findOne({ hotelId: booking.hotelId._id }).select("images").lean();
      const hotelImage = hotelImages?.images || [];

      return {
        ...booking,
        nights,
        hotelImage, // all hotel images
      };
    })
  );

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
        bookings: bookingsWithExtras,
      },
      "Past bookings fetched successfully"
    )
  );
});
const cancelHotelBooking = catchAsyncError(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;
  const { cancelReason } = req.body;

  const booking = await HotelBookingModel.findById(bookingId).populate("assignedRooms");

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  // Check ownership
  if (booking.bookedBy.toString() !== userId.toString()) {
    throw new ApiError(statusCode.UNAUTHORIZED, "You can only cancel your own booking");
  }

  // Check if already cancelled or completed
  if (["Cancelled", "Completed"].includes(booking.status)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Booking is already ${booking.status}`
    );
  }


  const now = Date.now();
  const checkInTime = new Date(booking.checkInDate).getTime();
  const hoursBeforeCheckIn = (checkInTime - now) / (1000 * 60 * 60);

  if (hoursBeforeCheckIn < 24) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "You can only cancel your booking at least 24 hours before the journey"
    );
  }

  
  booking.status = "Cancelled";
  booking.cancelledBy = "user";
  if (cancelReason) {
    booking.cancelReason = cancelReason;
  }
  const roomUpdatePromises = booking.assignedRooms.map((room) => {
    return individualRoom.updateOne(
      { _id: room._id },
      {
        $set: {
          status: "available",
          isAvailable: true,
          bookingReference: null,
          checkInDate: null,
          checkOutDate: null,
          checkInTime: null,
          checkOutTime: null,
        },
      }
    );
  });

  await Promise.all([...roomUpdatePromises, booking.save()]);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      booking,
      "Booking cancelled successfully"
    )
  );
});
const getCancelReasons = (req, res) => {
  try {
    return res.status(200).json({
      statusCode: 200,
      data: {
        cancelReasons: ["Static Price", "Behaviour", "Services", "Others"],
      },
      message: "Cancel reasons fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error("Cancel Reasons Fetch Error:", error);
    return res.status(500).json({
      statusCode: 500,
      data: null,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
  payHotelBookingPayment,
  getHotelsByLocation,
  getHotelById,
  getUpcomingBookings,
  getPastBookings,
getCancelReasons,
  cancelHotelBooking
};
