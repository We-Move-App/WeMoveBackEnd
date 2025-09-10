
const mongoose = require("mongoose");
const { Schema } = mongoose;

const individualRoomSchema = new mongoose.Schema(
    {
        roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
        hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
        status: {
            type: String,
            enum: ['available', 'booked', 'maintenance'],
            default: 'available',
        },
        isAvailable: { type: Boolean, default: true },
        roomNumber: { type: Number, required: true },
        bookingReference: {
            type: Schema.Types.ObjectId,
            ref: "HotelBooking",

        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "Hotel-Manager",
        },
        checkInDate: Date,
        checkOutDate: Date,
        checkInTime: Date,
        checkOutTime: Date,
    },
    { timestamps: true }
);

// roomSchema.index({ hotelId: 1, roomType: 1 }, { unique: true });

module.exports = mongoose.model("individualRoom", individualRoomSchema);
