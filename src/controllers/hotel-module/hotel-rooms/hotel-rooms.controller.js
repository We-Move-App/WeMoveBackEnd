const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");
const HotelBooking = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const { normalizeDate } = require("../../../utils/reqFunctions/reqFunction");
const statusCode = require("../../../utils/constants/statusCode");
const ApiResponse = require("../../../utils/response/ApiResponse");

const getAllRooms = catchAsyncError(async (req, res, next) => {
    const { hotelId, date, status, page = 1, limit = 100, sortBy = 'roomNumber', order = 'asc' } = req.query;

    if (!hotelId) {
        throw new ApiError(statusCode.BAD_REQUEST, "hotelId is required.");
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const sortOrder = order.toLowerCase() === 'desc' ? -1 : 1;

    // Initial query for rooms of the hotel
    let allRooms = await individualRoom.find({ hotelId });

    if (date) {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        // Find bookings overlapping targetDate
        const activeBookings = await HotelBooking.find({
            hotelId,
            status: "Booked",
            checkInDate: { $lte: targetDate },
            checkOutDate: { $gte: targetDate }
        });

        const bookedRoomIds = activeBookings
            .flatMap(booking => booking.assignedRooms.map(roomId => roomId.toString()));

        if (status === "booked") {
            allRooms = allRooms.filter(room => bookedRoomIds.includes(room._id.toString()));
        } else if (status === "available") {
            allRooms = allRooms.filter(room => !bookedRoomIds.includes(room._id.toString()));
        }
    } else if (status === "available" || status === "booked") {
        const condition = status === "available" ? true : false;
        allRooms = allRooms.filter(room => room.isAvailable === condition);
    }

    // Sorting rooms by sortBy field and order
    allRooms.sort((a, b) => {
        const getPriority = (roomNumber) => {
            const prefix = roomNumber.split("-")[0].toUpperCase();
            if (prefix === "G") return 1; // Standard first
            if (prefix === "T") return 2; // Luxury after
            return 3; // Others last
        };

        const getNumber = (roomNumber) => {
            const match = roomNumber.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
        };

        // Compare by type first
        const priorityA = getPriority(a.roomNumber);
        const priorityB = getPriority(b.roomNumber);

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // If same type, compare numbers
        const numA = getNumber(a.roomNumber);
        const numB = getNumber(b.roomNumber);

        return numA - numB;
    });


    // Pagination
    const totalRooms = allRooms.length;
    const startIndex = (pageNumber - 1) * pageSize;
    const paginatedRooms = allRooms.slice(startIndex, startIndex + pageSize);

    res.status(statusCode.OK).json(
        new ApiResponse(statusCode.OK, {
            totalRooms,
            page: pageNumber,
            limit: pageSize,
            rooms: paginatedRooms
        }, "Rooms fetched successfully.")
    );
});


const getSingleRoomById = catchAsyncError(async (req, res, next) => {
    const { roomId } = req.query;
    console.log(roomId, "roomId");

    if (!roomId) {
        throw new ApiError(statusCode.BAD_REQUEST, "Room ID is required.");
    }

    const room = await individualRoom.findById(roomId);
    if (!room) {
        throw new ApiError(statusCode.NOT_FOUND, "Room not found.");
    }

    res.status(statusCode.OK).json(
        new ApiResponse(statusCode.OK, room, "Single room fetched successfully.")
    );
});


const updateRoom = catchAsyncError(async (req, res, next) => {
    const { roomId } = req.query;

    if (!roomId) {
        throw new ApiError(statusCode.BAD_REQUEST, "Room ID is required.");
    }

    // Fetch the room and related booking
    const room = await individualRoom.findById(roomId);
    if (!room) {
        throw new ApiError(statusCode.NOT_FOUND, "Room not found.");
    }

    const booking = await HotelBooking.findById(room.bookingReference);
    if (!booking) {
        throw new ApiError(statusCode.NOT_FOUND, "Booking not found.");
    }

    // Get current time
    const now = new Date();

    // Update booking's checkout time
    const updatedBooking = {
        ...booking.toObject(),
        checkOutDate: now,
        checkOutTime: now,
        status: "Completed"
    };

    await HotelBooking.findByIdAndUpdate(room.bookingReference, {
        $set: {
            checkOutDate: now,
            checkOutTime: now,
            status: "Completed"
        }
    }, { new: true, runValidators: true });


    // Mark room as available
    const updatedRoom = await individualRoom.findByIdAndUpdate(

        roomId,
        {
            status: "available",
            isAvailable: true,
            bookingReference: null,
            checkOutDate: now,
            checkOutTime: now
        },
        {
            new: true,
            runValidators: true
        }
    );

    res.status(statusCode.OK).json(
        new ApiResponse(statusCode.OK, updatedRoom, "Room updated and checkout completed.")
    );
});

const fetchRoomStatus = catchAsyncError(async (req, res) => {
    const { hotelId } = req.params;
    let { startDate, endDate, status } = req.query;

    const start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date(start);
    end.setHours(23, 59, 59); // Ensure full day is counted

    if (!hotelId) {
        throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID is required.");
    }

    if (end < start) {
        throw new ApiError(statusCode.BAD_REQUEST, "End date cannot be before start date.");
    }

    if (status) status = status.toLowerCase();

    // Find all rooms in the hotel
    const allRooms = await individualRoom.find({ hotelId });

    // Get bookings that overlap with the given date range
    const overlappingBookings = await HotelBookings.find({
        hotelId,
        checkInDate: { $lt: end },
        checkOutDate: { $gt: start },
        assignedRooms: { $exists: true, $ne: [] },
    });

    // Collect booked room IDs and corresponding booking details
    const bookedRoomsDetails = {};
    overlappingBookings.forEach((booking) => {
        booking.assignedRooms.forEach((roomId) => {
            bookedRoomsDetails[roomId.toString()] = {
                bookingId: booking._id.toString(),
                status: "booked",
                roomTypeId: booking.roomTypeId,
                hotelId: hotelId
            };
        });
    });

    // Initialize result map
    const roomTypeMap = {};
    let totalAvailableCount = 0;
    let totalBookedCount = 0;

    for (let room of allRooms) {
        const roomType = await Room.findById(room.roomTypeId);
        if (!roomType) continue;

        const typeName = roomType.roomTypeName;
        const roomIdStr = room._id.toString();

        const isBooked = roomIdStr in bookedRoomsDetails;

        // Apply filter based on status if passed
        if (status === 'booked' && !isBooked) continue;
        if (status === 'available' && isBooked) continue;

        if (!roomTypeMap[typeName]) {
            roomTypeMap[typeName] = {
                roomTypeId: room.roomTypeId,
                roomTypeName: typeName,
                available: 0,
                booked: 0,
                availableRooms: [],
                bookedRooms: [],
            };
        }

        if (isBooked) {
            roomTypeMap[typeName].booked += 1;
            roomTypeMap[typeName].bookedRooms.push({
                roomId: room._id.toString(),
                roomNumber: room.roomNumber,
                bookingId: bookedRoomsDetails[roomIdStr].bookingId,
                status: bookedRoomsDetails[roomIdStr].status,
                roomTypeId: bookedRoomsDetails[roomIdStr].roomTypeId,
                hotelId: bookedRoomsDetails[roomIdStr].hotelId
            });
            totalBookedCount++;
        } else {
            roomTypeMap[typeName].available += 1;
            roomTypeMap[typeName].availableRooms.push({
                roomId: room._id.toString(),  // Use the room's _id as roomId
                roomNumber: room.roomNumber,  // Room number as human-readable
                status: "available",
                roomTypeId: room.roomTypeId,
                hotelId: hotelId,
                isAvailable: true
            });
            totalAvailableCount++;
        }
    }

    // Sort available and booked rooms numerically by roomId (or roomNumber if you want to sort by the room number)
    for (const roomType of Object.values(roomTypeMap)) {
        roomType.availableRooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
        roomType.bookedRooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
    }

    // Return response based on status
    let response = {
        totalAvailableCount,
        totalBookedCount,
        roomTypes: Object.values(roomTypeMap),
    };

    // If status is "available" or "booked", filter accordingly
    if (status === 'available') {
        response.roomTypes = response.roomTypes.map(roomType => ({
            ...roomType,
            bookedRooms: [],
        }));
    } else if (status === 'booked') {
        response.roomTypes = response.roomTypes.map(roomType => ({
            ...roomType,
            availableRooms: [],
        }));
    }

    return res.status(statusCode.OK).json(
        new ApiResponse(statusCode.OK, response, "Filtered room status")
    );
});





module.exports = {
    getAllRooms,
    getSingleRoomById,
    updateRoom,
    fetchRoomStatus

};
