// rideHandler.js
const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");
const {
  RideBookStatusEnum,
  PaymentStatusEnum,
} = require("../../utils/constants/ENUM");
/**
 * Assigns ride sequentially to nearby drivers
 */
const assignRideToDrivers = (io, bookingId, drivers, booking, vehicle, otp, index = 0) => {
  if (index >= drivers.length) {
    RideBookingDetail.findOneAndUpdate(
      { bookingId },
      {
        rideStatus: RideBookStatusEnum.CANCELLED,
        cancelledBy: "SYSTEM",
        reasonToCancel: "No drivers accepted",
        "timestamps.cancelledAt": new Date(),
      }
    );
    io.to(booking.userId).emit("ride:cancelled", {
      bookingId,
      reason: "No drivers accepted",
    });
    return;
  }

  const driver = drivers[index];
  RideBookingDetail.findOneAndUpdate({ bookingId }, { driverId: driver.driverId });

  io.to(driver.driverId).emit("ride:incoming", {
    bookingId,
    pickup: booking.pickupLocation,
    drop: booking.dropLocation,
    fare: vehicle.estimatedFare,
    vehicleType: vehicle.vehicleType,
    userId: booking.userId,
    otp,
  });

  setTimeout(async () => {
    const current = await RideBookingDetail.findOne({ bookingId });
    if (current.rideStatus === RideBookStatusEnum.REQUESTED) {
      assignRideToDrivers(io, bookingId, drivers, booking, vehicle, otp, index + 1);
    }
  }, 6000);
};

/**
 * Main ride socket handler
 */
const rideHandler = (socket, io, role) => {
  console.log(`⚡ New ${role} connection: ${socket.id}`);

  if (role === "driver") {
    console.log(`🚕 Driver connected: ${socket.data.driverId}`);

    socket.on("ride:accept", async (data, ack) => {
      try {
        const updated = await RideBookingDetail.findOneAndUpdate(
          {
            bookingId: data.bookingId,
            rideStatus: RideBookStatusEnum.REQUESTED,
          },
          {
            rideStatus: RideBookStatusEnum.ACCEPTED,
            "timestamps.acceptedAt": new Date(),
          },
          { new: true }
        );

        if (!updated) {
          return ack({ success: false, error: "Ride already taken or cancelled" });
        }

        io.to(updated.userId).emit("ride:accepted", {
          bookingId: data.bookingId,
          driverId: socket.data.driverId,
          otp: updated.expectedOtp,
        });

        ack({ success: true });
      } catch (err) {
        console.error("Accept error:", err);
        ack({ success: false, error: "Failed to accept ride" });
      }
    });

    socket.on("ride:reject", async (data, ack) => {
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          {
            $push: {
              cancelledByDrivers: {
                driverId: socket.data.driverId,
                cancelledAt: new Date(),
              },
            },
          }
        );
        ack({ success: true });
      } catch (err) {
        console.error("Reject error:", err);
        ack({ success: false, error: "Failed to reject ride" });
      }
    });

    socket.on("ride:arrived", async (data, ack) => {
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          {
            rideStatus: RideBookStatusEnum.ARRIVED,
            "timestamps.arrivedAt": new Date(),
          }
        );
        const booking = await RideBookingDetail.findOne({ bookingId: data.bookingId });
        io.to(booking.userId).emit("ride:arrived", { bookingId: data.bookingId });
        ack({ success: true });
      } catch (err) {
        console.error("Arrived error:", err);
        ack({ success: false, error: "Failed to confirm arrival" });
      }
    });

    socket.on("ride:verifyOtp", async (data, ack) => {
      try {
        const booking = await RideBookingDetail.findOne({ bookingId: data.bookingId });
        if (!booking) return ack({ success: false, error: "Booking not found" });

        const isOtpValid = booking.expectedOtp === data.otp;
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          {
            otpVerified: isOtpValid,
            enteredOtp: data.otp,
            ...(isOtpValid && {
              rideStatus: RideBookStatusEnum.PICKED_UP,
              "timestamps.pickupAt": new Date(),
            }),
          }
        );

        io.to(booking.userId).emit("ride:otpVerified", {
          bookingId: data.bookingId,
          success: isOtpValid,
        });

        ack({ success: isOtpValid, error: isOtpValid ? null : "Invalid OTP" });
      } catch (err) {
        console.error("OTP verification error:", err);
        ack({ success: false, error: "Failed to verify OTP" });
      }
    });

    socket.on("ride:start", async (data, ack) => {
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          {
            rideStatus: RideBookStatusEnum.ON_RIDE,
            "timestamps.rideStartedAt": new Date(),
          }
        );
        const booking = await RideBookingDetail.findOne({ bookingId: data.bookingId });
        io.to(booking.userId).emit("ride:started", { bookingId: data.bookingId });
        ack({ success: true });
      } catch (err) {
        console.error("Start ride error:", err);
        ack({ success: false, error: "Failed to start ride" });
      }
    });

    socket.on("ride:complete", async (data, ack) => {
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          {
            rideStatus: RideBookStatusEnum.COMPLETED,
            paymentStatus: PaymentStatusEnum.SUCCESS,
            "timestamps.completedAt": new Date(),
          }
        );
        const booking = await RideBookingDetail.findOne({ bookingId: data.bookingId });
        io.to(booking.userId).emit("ride:completed", { bookingId: data.bookingId });
        ack({ success: true });
      } catch (err) {
        console.error("Complete ride error:", err);
        ack({ success: false, error: "Failed to complete ride" });
      }
    });

    socket.on("ride:cancel", async (data, ack) => {
      try {
        const updated = await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          {
            rideStatus: RideBookStatusEnum.CANCELLED,
            reasonToCancel: data.reason,
            cancelledBy: "DRIVER",
            "timestamps.cancelledAt": new Date(),
            $push: {
              cancelledByDrivers: {
                driverId: socket.data.driverId,
                cancelledAt: new Date(),
              },
            },
          },
          { new: true }
        );

        if (updated) {
          io.to(updated.userId).emit("ride:cancelled", {
            bookingId: data.bookingId,
            reason: data.reason,
          });
          ack({ success: true });
        } else {
          ack({ success: false, error: "Booking not found" });
        }
      } catch (err) {
        console.error("Cancel ride error:", err);
        ack({ success: false, error: "Failed to cancel ride" });
      }
    });
  }
};

module.exports = { rideHandler, assignRideToDrivers };