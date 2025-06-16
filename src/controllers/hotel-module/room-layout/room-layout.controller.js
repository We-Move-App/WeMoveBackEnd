// const statusCode = require("../../../utils/constants/statusCode");
// const {
//   getTodayNormalized,
//   normalizeDate,
// } = require("../../../utils/reqFunctions/reqFunction");
// const ApiError = require("../../../utils/response/ApiError");
// const ApiResponse = require("../../../utils/response/ApiResponse");
// const catchAsyncError = require("../../../utils/response/catchAsyncError");
// const cron = require("node-cron");
// const moment = require("moment");
// const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
// const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
// const roomLayoutModel = require("../../../models/hotel-module/roomManagement/roomManagement.model");
// const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
// const mongoose = require("mongoose");

// // Create hotel room layout
// const createRoomLayout = catchAsyncError(async (req, res, next) => {
//   const { hotelId, roomType } = req.query;

//   if (!hotelId || !roomType) {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       "Hotel ID and room type are required"
//     );
//   }
//   const roomDetails = await Room.findOne({ hotelId, roomType });

//   if (!roomDetails) {
//     throw new ApiError(statusCode.NOT_FOUND, "Room not found with this type");
//   }

//   const { numberOfRoom, roomPrice, amenities } = roomDetails;
//   const totalRooms = parseInt(numberOfRoom);


//   const bookingDateNormalized = getTodayNormalized();

//   const existingLayout = await roomLayoutModel.findOne({
//     hotelId,
//     roomType,
//   });

//   if (existingLayout) {
//     console.log("Existing layout found:", existingLayout);
//     throw new ApiError(
//       statusCode.CONFLICT,
//       "Room layout already exists for this hotel and room type"
//     );
//   }

//   const findHotel = await Hotel.findById(hotelId).select("_id totalRooms");

//   if (!findHotel) {
//     throw new ApiError(statusCode.NOT_FOUND, "Hotel not found");
//   }

//   const bookedRoomsCount = await roomLayoutModel.countDocuments({
//     hotelId,
//     bookingDate: bookingDateNormalized,
//     "rooms.status": "booked",
//   });

//   const availableRoomsCount = totalRooms - bookedRoomsCount;

//   const Rooms = Array.from({ length: totalRooms }, (_, i) => ({
//     roomNumber: `G${i + 1}`,
//     isAvailable: true,
//     roomType,
//     status: "available",
//   }));

//   const newRoomLayout = await roomLayoutModel.create({
//     hotelId,
//     roomType,
//     totalRooms,
//     roomPrice,
//     amenities,
//     bookedRooms: bookedRoomsCount,
//     availableRooms: availableRoomsCount,
//     createdBy: req.user._id,
//     rooms: Rooms,
//   });

//   findHotel.totalRooms = totalRooms;
//   await findHotel.save();

//   return res.status(statusCode.CREATED).json(
//     new ApiResponse(
//       statusCode.CREATED,
//       {
//         newRoomLayout,
//         bookedRooms: bookedRoomsCount,
//         availableRooms: availableRoomsCount,
//       },
//       "Hotel room layout created successfully"
//     )
//   );r
// });

// const getSingleRoomDetails = catchAsyncError(async (req, res, next) => {
//   const { hotelId, roomId } = req.query;

//   if (!hotelId || !roomId) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID and Room ID are required");
//   }

//   const findHotel = await Hotel.findById(hotelId).select("_id");
//   if (!findHotel) {
//     throw new ApiError(statusCode.NOT_FOUND, "Hotel not found");
//   }

//   const roomLayout = await roomLayoutModel.findOne({ hotelId }).populate({
//     path: "rooms.bookingReference",
//     model: "HotelBooking",
//   });

//   if (!roomLayout) {
//     throw new ApiError(statusCode.NOT_FOUND, "Room layout not found");
//   }

//   const room = roomLayout?.rooms?.find((r) => r._id.toString() === roomId.toString());
//   if (!room) {
//     throw new ApiError(statusCode.NOT_FOUND, "Room not found");
//   }

//   res.status(statusCode.OK).json(
//     new ApiResponse(statusCode.OK, room, "Room details retrieved successfully")
//   );
// });

// const getAllRooms = catchAsyncError(async (req, res, next) => {
//   const { hotelId } = req.query;

//   if (!hotelId) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID is required");
//   }

//   const bookingDateNormalized = getTodayNormalized();

//   // Find layouts for both 'standard' and 'luxury' types
//   const layouts = await roomLayoutModel.find({
//     hotelId,
//     bookingDate: bookingDateNormalized,
//     roomType: { $in: ['standard', 'luxury'] },
//   });

//   if (!layouts.length) {
//     throw new ApiError(statusCode.NOT_FOUND, "No room layouts found for this hotel on this date");
//   }

//   const layoutData = layouts.map(layout => ({
//     layoutId: layout._id,
//     hotelId: layout.hotelId,
//     roomType: layout.roomType,
//     bookingDate: layout.bookingDate,
//     rooms: layout.rooms,
//     totalRooms: layout.totalRooms,
//     availableRooms: layout.availableRooms,
//     roomPrice: layout.roomPrice,
//     amenities: layout.amenities,
//     bookedRooms: layout.bookedRooms,
//     createdBy: layout.createdBy,
//     createdAt: layout.createdAt,
//     updatedAt: layout.updatedAt,
//     __v: layout.__v,
//   }));

//   return res.status(statusCode.OK).json(
//     new ApiResponse(
//       statusCode.OK,
//       { layoutData },
      
//       "Hotel rooms retrieved successfully",
//       true
//     )
//   );
// });

// // Delete room layout
// const deleteRooms = catchAsyncError(async (req, res, next) => {
//   const { hotelId, layoutId } = req.query;

//   if (!hotelId || !layoutId) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID and Layout ID required");
//   }

//   const hotel = await Hotel.findById(hotelId);
//   if (!hotel) {
//     throw new ApiError(statusCode.NOT_FOUND, "Hotel not found");
//   }

//   const deletedLayout = await roomLayoutModel.findOneAndDelete({
//     hotelId,
//     _id: layoutId,
//   });

//   if (!deletedLayout) {
//     throw new ApiError(statusCode.NOT_FOUND, "No room layout found");
//   }

//   return res.status(statusCode.OK).json(
//     new ApiResponse(statusCode.OK, 
//       {
//         deletedLayoutId: deletedLayout._id,
//         hotelId: deletedLayout.hotelId,
//         bookingDate: deletedLayout.bookingDate,
//       },
      
//       "Hotel room layout deleted successfully")
//   );
// });

// // Cron to delete old room layouts
// const deleteOldHotelLayouts = async () => {
//   try {
//     const cutoffDate = moment().subtract(2, "days").startOf("day").toDate();

//     const result = await roomLayoutModel.deleteMany({
//       bookingDate: { $lt: cutoffDate },
//     });

//     console.log(`[Cron] Deleted ${result.deletedCount} old hotel room layout(s)`);
//   } catch (error) {
//     console.error("[Cron] Error deleting old hotel layouts:", error);
//   }
// };

// cron.schedule("0 0 * * *", () => {
//   console.log("[Cron] Running nightly deletion job for hotel rooms");
//   deleteOldHotelLayouts();
// });

// module.exports = {
//   createRoomLayout,
//   getSingleRoomDetails,
//   getAllRooms,
//   deleteRooms,
// };
