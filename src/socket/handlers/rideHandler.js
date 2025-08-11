// rideHandler.js
const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");
const {
  RideBookStatusEnum,
  PaymentStatusEnum,
  DriverDocEnum,
} = require("../../utils/constants/ENUM");
const {
  getDistanceAndDuration,
} = require("../../utils/map/get-distance-and-duration");
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");
const VehicleDetails = require("../../models/new-driver-module/vehicle-details/vehicle-details.model");
const DriverDocDetails = require("../../models/new-driver-module/documents/driver-documents.model");
const activeAssignTimers = new Map();
/**
 * Assigns ride sequentially to nearby drivers
 */
const assignRideToDrivers = async (
  io,
  bookingId,
  drivers,
  booking,
  vehicle,
  otp,
  index = 0
) => {
  console.log("bookingId", bookingId);
  // Prevent overlapping timers for same booking
  if (activeAssignTimers.has(bookingId)) {
    console.log(`⚠️ Skipping duplicate assignment loop for ${bookingId}`);
    return;
  }

  if (index >= drivers.length) {
    console.log("🚫 No more drivers to assign - cancelling ride");
    activeAssignTimers.delete(bookingId);
    await RideBookingDetail.findOneAndUpdate(
      { bookingId },
      {
        rideStatus: RideBookStatusEnum.CANCELLED,
        cancelledBy: "SYSTEM",
        reasonToCancel: "No drivers accepted",
        "timestamps.cancelledAt": new Date(),
      }
    );
    io.to(booking.userId.toString()).emit("ride:cancelled", {
      bookingId,
      reason: "No drivers accepted",
    });
    return;
  }

  const driver = drivers[index];
  console.log(
    `🔄 Attempting to assign ride ${bookingId} to driver ${driver.driverId} (${index + 1}/${drivers.length})`
  );

  try {
    // Distance calculation (unchanged)
    const driverLoc = driver.location?.coordinates;
    const pickupLoc = booking.pickupLocation?.location?.coordinates;
    let distanceToPickup = null;
    let timeToPickup = null;

    if (driverLoc?.length === 2 && pickupLoc?.length === 2) {
      try {
        const { distanceInKm, durationInMin } = await getDistanceAndDuration(
          { lat: driverLoc[1], lng: driverLoc[0] },
          { lat: pickupLoc[1], lng: pickupLoc[0] }
        );
        distanceToPickup = distanceInKm.toString();
        timeToPickup = durationInMin.toString();
      } catch (err) {
        console.error(
          `❌ Failed to get distance/time for driver ${driver.driverId}:`,
          err.message
        );
      }
    }

    await RideBookingDetail.findOneAndUpdate(
      { bookingId },
      { driverId: driver.driverId }
    );

    console.log(`📢 Emitting 'ride:incoming' to driver ${driver.driverId}`);
    io.to(driver.driverId).emit("ride:incoming", {
      rideId: bookingId,
      pickup: {
        address: booking.pickupLocation?.address,
        lat: pickupLoc?.[1],
        lng: pickupLoc?.[0],
      },
      drop: {
        address: booking.dropLocation?.address,
        lat: booking.dropLocation?.location?.coordinates?.[1],
        lng: booking.dropLocation?.location?.coordinates?.[0],
      },
      estimatedFare: vehicle.estimatedFare,
      vehicleType: vehicle.vehicleType,
      distanceToPickup,
      timeToPickup,
    });

    console.log(`✅ Emission successful to driver ${driver.driverId}`);

    // Store active timer so no duplicates run
    const timeoutId = setTimeout(async () => {
      console.log(`⏰ Timeout checking status for ride ${bookingId}`);
      activeAssignTimers.delete(bookingId);
      const current = await RideBookingDetail.findOne({ bookingId });
      if (current?.rideStatus === RideBookStatusEnum.REQUESTED) {
        console.log(`🔄 Moving to next driver for ride ${bookingId}`);
        assignRideToDrivers(
          io,
          bookingId,
          drivers,
          booking,
          vehicle,
          otp,
          index + 1
        );
      }
    }, 12000);

    activeAssignTimers.set(bookingId, timeoutId);

    const cleanup = () => {
      console.log(`🧹 Cleaning up timeout for ride ${bookingId}`);
      clearTimeout(timeoutId);
      activeAssignTimers.delete(bookingId);
    };

    io.once(`ride:accepted:${bookingId}`, cleanup);
  } catch (error) {
    console.error(`❌ Error assigning to driver ${driver.driverId}:`, error);
    activeAssignTimers.delete(bookingId);
    assignRideToDrivers(
      io,
      bookingId,
      drivers,
      booking,
      vehicle,
      otp,
      index + 1
    );
  }
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
        console.log("bookingId ...", data.bookingId);
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

        console.log("updated", updated);

        if (!updated) {
          return ack({
            success: false,
            error: "Ride already taken or cancelled",
          });
        }

        const driverDetails = await DriverBasicDetails.findOne({
          driverId: socket.data.driverId,
        });
        const vehicleDetails = await VehicleDetails.findOne({
          driverId: socket.data.driverId,
        });
        const driverDocument = await DriverDocDetails.findOne({
          driverId: socket.data.driverId,
        });

        const avatarUrl =
          driverDocument?.documents?.find(
            (doc) => doc.documentType === DriverDocEnum.AVATAR
          )?.fileUrl || null;

        const vehiclePhotoUrl =
          driverDocument?.documents?.find(
            (doc) => doc.documentType === DriverDocEnum.VEHICLEPHOTO
          )?.fileUrl || null;

        io.to(updated.userId).emit("ride:accepted", {
          rideId: data.bookingId,
          driverId: socket.data.driverId,
          driverName: driverDetails?.fullName || "Driver",
          vehicleImage: vehiclePhotoUrl,
          driverImage: avatarUrl,
          estimatedFare: updated.fare,
          vehicleType: vehicleDetails?.vehicleType || "t/b",
          otp: updated.expectedOtp,
          pickupLocation: {
            address: updated?.pickupLocation?.address ?? null,
            coordinates: [
              ...(updated?.pickupLocation?.location?.coordinates ?? []),
            ].reverse(),
          },
          dropLocation: {
            address: updated?.dropLocation?.address ?? null,
            coordinates: [
              ...(updated?.dropLocation?.location?.coordinates ?? []),
            ].reverse(),
          },
        });

        const rideData = {
          rideId: updated?.bookingId ?? null,
          pickup: {
            address: updated?.pickupLocation?.address ?? null,
            coordinates: [
              ...(updated?.pickupLocation?.location?.coordinates ?? []),
            ].reverse(),
          },
          drop: {
            address: updated?.dropLocation?.address ?? null,
            coordinates: [
              ...(updated?.dropLocation?.location?.coordinates ?? []),
            ].reverse(),
          },
          estimatedFare: updated?.fare ?? null,
          vehicleType: updated?.vehicleType ?? null,
          otp: updated?.expectedOtp ?? null,
        };

        ack({
          success: true,
          ride: rideData,
        });
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
        const booking = await RideBookingDetail.findOne({
          bookingId: data.bookingId,
        });
        io.to(booking.userId).emit("ride:arrived", {
          bookingId: data.bookingId,
        });
        ack({ success: true });
      } catch (err) {
        console.error("Arrived error:", err);
        ack({ success: false, error: "Failed to confirm arrival" });
      }
    });

    socket.on("ride:verifyOtp", async (data, ack) => {
      try {
        const booking = await RideBookingDetail.findOne({
          bookingId: data.bookingId,
        });
        if (!booking)
          return ack({ success: false, error: "Booking not found" });

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
        const booking = await RideBookingDetail.findOne({
          bookingId: data.bookingId,
        });
        io.to(booking.userId).emit("ride:started", {
          bookingId: data.bookingId,
        });
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
        const booking = await RideBookingDetail.findOne({
          bookingId: data.bookingId,
        });
        io.to(booking.userId).emit("ride:completed", {
          bookingId: data.bookingId,
        });
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
