// rideHandler.js
const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");
const {
  RideBookStatusEnum,
  PaymentStatusEnum,
  DriverDocEnum,
  LocationStatusEnum,
  BookCancelledByEnum,
} = require("../../utils/constants/ENUM");
const {
  getDistanceAndDuration,
} = require("../../utils/map/get-distance-and-duration");
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");
const VehicleDetails = require("../../models/new-driver-module/vehicle-details/vehicle-details.model");
const DriverDocDetails = require("../../models/new-driver-module/documents/driver-documents.model");
const activeAssignTimers = new Map();
const DriverLocation = require("../../models/new-driver-module/location/driver-location.model");
const ChatModel = require("../../models/new-driver-module/chat-details/chat-details.model");
const {
  sendPushNotification,
} = require("../../controllers/firebase/fcm-token.controller");
const logger = require("../../utils/logger/logger");
const { Logger } = require("winston");
const {
  createNotification,
} = require("../../controllers/global-notification-module/global-notification.controller");
/**
 * Assigns ride sequentially to nearby drivers
 */
// Keep one timer/listener per booking
// bookingId -> { timeoutId, acceptEvent, acceptHandler }
const assignmentGuards = new Map();

const stopAssigning = (io, bookingId) => {
  const guard = assignmentGuards.get(bookingId);
  if (!guard) return;

  if (guard.timeoutId) clearTimeout(guard.timeoutId);
  if (guard.acceptEvent && guard.acceptHandler) {
    io.off(guard.acceptEvent, guard.acceptHandler);
  }
  assignmentGuards.delete(bookingId);
};

const isAlreadyAssigned = async (bookingId) => {
  const doc = await RideBookingDetail.findOne({ bookingId }, { rideStatus: 1 });
  return doc?.rideStatus === RideBookStatusEnum.ACCEPTED;
};

// TODO : https://chatgpt.com/share/68a6d364-ce78-8008-b503-4a27eb385b45 (reassignment)

const assignRideToDrivers = async (
  io,
  bookingId,
  drivers,
  booking,
  vehicle,
  otp,
  batchIndex = 0,
  batchSize = 5
) => {
  if (await isAlreadyAssigned(bookingId)) {
    stopAssigning(io, bookingId);
    return;
  }

  // ---- Batch slicing
  const start = batchIndex * batchSize;
  const end = Math.min(start + batchSize, drivers.length);
  const currentBatch = drivers.slice(start, end);

  if (currentBatch.length === 0) {
    // Double-check before cancelling
    if (await isAlreadyAssigned(bookingId)) {
      stopAssigning(io, bookingId);
      return;
    }

    logger.info("No more drivers to assign - cancelling ride");

    await RideBookingDetail.findOneAndUpdate(
      { bookingId, rideStatus: { $ne: RideBookStatusEnum.ACCEPTED } }, // don't overwrite if accepted
      {
        rideStatus: RideBookStatusEnum.CANCELLED,
        cancelledBy: BookCancelledByEnum.SYSTEM,
        reasonToCancel: "No drivers accepted",
        "timestamps.cancelledAt": new Date(),
      }
    );
    io.to(booking.userId.toString()).emit("ride:noDriver", {
      rideId: bookingId,
      reason: "No drivers accepted",
    });

    await createNotification(
      booking.userId,
      "Ride Cancelled",
      "No drivers were available for your ride"
    );

    stopAssigning(io, bookingId);
    return;
  }

  for (const driver of currentBatch) {
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
        logger.error(
          `Failed to get distance/time for driver ${driver.driverId}:`,
          err.message
        );
      }
    }

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
    await sendPushNotification(
      driver.driverId,
      "New Ride Request",
      `Pickup at ${booking.pickupLocation?.address || "Unknown location"}`,
      { rideId: bookingId }
    );
  }

  // ---- Accept handler (atomic DB winner)
  const acceptEvent = `ride:accepted:${bookingId}`;
  const acceptHandler = async (data) => {
    // Only process if driver is from this batch
    if (!currentBatch.some((d) => d.driverId === data.driverId)) return;

    // Atomic update: only first one wins
    const updated = await RideBookingDetail.findOneAndUpdate(
      {
        bookingId,
        rideStatus: RideBookStatusEnum.PENDING, // only if still pending
      },
      {
        rideStatus: RideBookStatusEnum.ACCEPTED,
        driverId: data.driverId,
        otp,
        "timestamps.acceptedAt": new Date(),
      },
      { new: true }
    );

    if (!updated) {
      // Someone else already accepted
      return;
    }

    logger.info(`Driver ${data.driverId} accepted ride ${bookingId}`);

    try {
      await Promise.all([
        createNotification(
          data.driverId,
          "Ride Assigned",
          `You have successfully accepted ride ${bookingId}`
        ),
        createNotification(
          booking.userId,
          "Driver Assigned",
          "Your ride has been accepted by a driver"
        ),
      ]);
    } catch (err) {
      logger.error("Notification failed:", err.message);
    }

    // Stop timers + listeners
    stopAssigning(io, bookingId);

    // Notify user
    io.to(booking.userId.toString()).emit("ride:accepted", {
      bookingId,
      driverId: data.driverId,
    });

    // Optionally notify other drivers in this batch
    for (const d of currentBatch) {
      if (d.driverId !== data.driverId) {
        io.to(d.driverId).emit("ride:expired", { rideId: bookingId });
      }
    }
  };

  // ---- Cleanup old handler if exists, then register new one
  const existing = assignmentGuards.get(bookingId);
  if (existing?.acceptHandler) {
    io.off(existing.acceptEvent, existing.acceptHandler);
    if (existing.timeoutId) clearTimeout(existing.timeoutId);
  }

  io.on(acceptEvent, acceptHandler);

  // ---- Timeout after 8s
  const timeoutId = setTimeout(async () => {
    if (await isAlreadyAssigned(bookingId)) {
      stopAssigning(io, bookingId);
      return;
    }

    io.off(acceptEvent, acceptHandler);

    // Mark this batch as ignored
    await RideBookingDetail.findOneAndUpdate(
      { bookingId, rideStatus: RideBookStatusEnum.PENDING },
      {
        $push: {
          cancelledByDrivers: currentBatch.map((d) => ({
            driverId: d.driverId,
            cancelledAt: new Date(),
          })),
        },
      }
    );

    // Try next batch if still pending
    if (!(await isAlreadyAssigned(bookingId))) {
      assignRideToDrivers(
        io,
        bookingId,
        drivers,
        booking,
        vehicle,
        otp,
        batchIndex + 1,
        batchSize
      );
    } else {
      stopAssigning(io, bookingId);
    }
  }, 10000);

  assignmentGuards.set(bookingId, { timeoutId, acceptEvent, acceptHandler });
};

/**
 * Main ride socket handler
 */
const rideHandler = (socket, io, role) => {
  logger.info(`New ${role} connection: ${socket.id}`);

  if (role === "driver") {
    logger.info(`Driver connected: ${socket.data.driverId}`);

    socket.on("ride:accept", async (data, ack) => {
      try {
        logger.info(`bookingId ...", data.bookingId`);

        // Update driverId now when accepting
        const updated = await RideBookingDetail.findOneAndUpdate(
          {
            bookingId: data.bookingId,
            rideStatus: RideBookStatusEnum.REQUESTED,
          },
          {
            driverId: socket.data.driverId, // set driverId here
            rideStatus: RideBookStatusEnum.ACCEPTED,
            "timestamps.acceptedAt": new Date(),
          },
          { new: true }
        );

        if (!updated) {
          return ack({
            success: false,
            error: "Ride already taken or cancelled",
          });
        }

        // Chat handling starts here
        // Deactivate old chats for this booking
        await ChatModel.updateMany(
          { bookingId: data.bookingId },
          { $set: { isActive: false } }
        );

        // Ensure a new active chat exists for this driver-user pair
        await ChatModel.findOneAndUpdate(
          {
            bookingId: data.bookingId,
            driverId: socket.data.driverId,
            userId: updated.userId,
          },
          {
            $setOnInsert: {
              bookingId: data.bookingId,
              driverId: socket.data.driverId,
              userId: updated.userId,
              chats: [],
              isActive: true,
            },
          },
          { upsert: true, new: true }
        );
        // Chat handling ends here

        // Make driver on trip
        await DriverLocation.findOneAndUpdate(
          { driverId: socket.data.driverId },
          { status: LocationStatusEnum.ONTRIP }
        );

        // Emit cleanup signal
        io.emit(`ride:accepted:${data.bookingId}`);

        // Driver joins chat room = rideId
        socket.join(data.bookingId);

        // Put the user into the same room (rideId)
        const userSocket = [...io.sockets.sockets.values()].find(
          (s) => s.data?.userId?.toString() === updated.userId.toString()
        );
        if (userSocket) {
          userSocket.join(data.bookingId);
        }

        // Rest of your existing code remains unchanged...
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

        // console.log("Ride:Accept Push Notifi...");
        await sendPushNotification(
          updated.userId,
          "Ride Accepted",
          "Your driver is on the way",
          { rideId: data.bookingId }
        );

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
        logger.error("Accept error:", err);
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
        logger.error("Reject error:", err);
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
        // console.log("Ride:Arrived Push Notifi...");
        await sendPushNotification(
          booking.userId,
          "Driver Arrived",
          "Your driver has arrived at pickup location",
          { rideId: data.bookingId }
        );
        ack({ success: true });
      } catch (err) {
        Logger.error("Arrived error:", err);
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
        // console.log("ride:verifyOTP Push Notifi...");
        await sendPushNotification(
          booking.userId,
          "Ride Started",
          "Happy Journey",
          { rideId: data.bookingId }
        );

        ack({ success: isOtpValid, error: isOtpValid ? null : "Invalid OTP" });
      } catch (err) {
        logger.error("OTP verification error:", err);
        ack({ success: false, error: "Failed to verify OTP" });
      }
    });

    socket.on("ride:start", async (data, ack) => {
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          {
            rideStatus: RideBookStatusEnum.ONGOING,
            "timestamps.rideStartedAt": new Date(),
          }
        );
        const booking = await RideBookingDetail.findOne({
          bookingId: data.bookingId,
        });
        io.to(booking.userId).emit("ride:started", {
          rideId: data.bookingId,
          driverId: data.driverId,
          isRideStarted: true,
          rideStatus: RideBookStatusEnum.ONGOING,
        });
        ack({ success: true });
      } catch (err) {
        logger.error("Start ride error:", err);
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
          fare: booking.fare,
        });
        // console.log("ride:complete Push Notifi...");
        await sendPushNotification(
          booking.userId,
          "Ride Completed",
          "Your trip has ended. Please check fare details.",
          { rideId: data.bookingId }
        );
        ack({ success: true });
      } catch (err) {
        logger.error("Complete ride error:", err);
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
        logger.error("Cancel ride error:", err);
        ack({ success: false, error: "Failed to cancel ride" });
      }
    });
  }
};

module.exports = { rideHandler, assignRideToDrivers };
