const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");
const {
  RideBookStatusEnum,
  EntityCodeEnum,
  PaymentStatusEnum,
} = require("../../utils/constants/ENUM");
const generateCustomId = require("../../utils/customId/generateCustomId");
const findNearbyDrivers = require("../../utils/map/find-near-by-drivers");
const { getOtp } = require('../../utils/otpService/otpService');

const rideHandler = (socket, io, role) => {
  console.log(`⚡ New ${role} connection: ${socket.id}`);

  if (role === "user") {
    socket.on("ride:request", async (payload, ack) => {
      try {
        console.log("🚖 Ride request received:", payload);
        const { userId, pickupLocation, dropLocation, fare, vehicleType } = payload;

        // Validate required fields
        if (!pickupLocation?.lat || !pickupLocation?.lng || !pickupLocation?.address) {
          throw new Error("Invalid pickup location data");
        }
        if (!dropLocation?.lat || !dropLocation?.lng || !dropLocation?.address) {
          throw new Error("Invalid drop location data");
        }

        // Convert to [lng, lat] for MongoDB
        const pickupCoords = [pickupLocation.lat, pickupLocation.lng];
        console.log("🔍 Searching drivers near:", pickupCoords);

        const nearbyDrivers = await findNearbyDrivers(pickupCoords, vehicleType);
        console.log("🛵 Found drivers:", nearbyDrivers.length);

        if (nearbyDrivers.length === 0) {
          console.log("❌ No drivers available");
          return ack({ success: false, message: "No nearby drivers" });
        }

        const bookingId = await generateCustomId(EntityCodeEnum.RIDES, "R");
        const otp = getOtp();
        console.log("📝 Creating booking:", bookingId);

        // Create new booking with proper location structure
        const newBooking = await RideBookingDetail.create({
          bookingId,
          userId,
          pickupLocation: {
            address: pickupLocation.address,
            location: {
              type: "Point",
              coordinates: [pickupLocation.lat, pickupLocation.lng]
            }
          },
          dropLocation: {
            address: dropLocation.address,
            location: {
              type: "Point",
              coordinates: [dropLocation.lat, dropLocation.lng]
            }
          },
          fare,
          vehicleType,
          rideStatus: RideBookStatusEnum.REQUESTED,
          expectedOtp: otp,
          distanceInKm: 0, 
          durationInMin: 0, 
          timestamps: { requestedAt: new Date() },
        });

        console.log("👨‍💼 Notifying user with OTP:", otp);
        ack({ success: true, bookingId, otp });

        // Driver assignment logic
        const assignToDriver = async (index = 0) => {
          if (index >= nearbyDrivers.length) {
            console.log("⏳ No drivers accepted the ride");
            await RideBookingDetail.findOneAndUpdate(
              { bookingId },
              { 
                rideStatus: RideBookStatusEnum.CANCELLED, 
                cancelledBy: "SYSTEM",
                reasonToCancel: "No drivers available",
                "timestamps.cancelledAt": new Date() 
              }
            );
            io.to(userId).emit("ride:cancelled", { 
              bookingId,
              reason: "No drivers available" 
            });
            return;
          }

          const driver = nearbyDrivers[index];
          console.log(`🚗 Assigning to driver ${driver.driverId} (${index + 1}/${nearbyDrivers.length})`);

          // Assign to this driver
          await RideBookingDetail.findOneAndUpdate(
            { bookingId },
            { driverId: driver.driverId }
          );

          console.log("📲 Sending request to driver:", driver.driverId);
          io.to(driver.driverId).emit("ride:incoming", {
            bookingId,
            pickupLocation: newBooking.pickupLocation,
            dropLocation: newBooking.dropLocation,
            fare,
            vehicleType,
            userId,
            otp,
          });

          // Wait for driver response (6 seconds)
          setTimeout(async () => {
            const booking = await RideBookingDetail.findOne({ bookingId });
            if (booking.rideStatus === RideBookStatusEnum.REQUESTED) {
              console.log("⏰ Driver timeout, trying next driver");
              assignToDriver(index + 1);
            }
          }, 6000);
        };

        assignToDriver();

      } catch (err) {
        console.error("💥 Ride request error:", err);
        ack({ 
          success: false, 
          message: err.message || "Failed to request ride",
          error: err.toString() 
        });
      }
    });
  }

  if (role === "driver") {
    console.log(`🚕 Driver connected: ${socket.data.driverId}`);

    socket.on("ride:incoming", (data) => {
      console.log(`📩 Incoming ride to driver ${socket.data.driverId}:`, data.bookingId);
    });

    socket.on("ride:accept", async (data, ack) => {
      console.log(`✅ Driver ${socket.data.driverId} accepting ride:`, data.bookingId);
      try {
        const updated = await RideBookingDetail.findOneAndUpdate(
          { 
            bookingId: data.bookingId, 
            rideStatus: RideBookStatusEnum.REQUESTED 
          },
          { 
            rideStatus: RideBookStatusEnum.ACCEPTED,
            "timestamps.acceptedAt": new Date() 
          },
          { new: true }
        );

        if (!updated) {
          console.log("❌ Ride already taken:", data.bookingId);
          return ack({ 
            success: false,
            error: "Ride already taken or cancelled" 
          });
        }

        console.log(`👌 Notifying user ${updated.userId}`);
        io.to(updated.userId).emit("ride:accepted", {
          bookingId: data.bookingId,
          driverId: socket.data.driverId,
          otp: updated.expectedOtp,
        });

        ack({ success: true });

      } catch (err) {
        console.error("Accept error:", err);
        ack({ 
          success: false,
          error: "Failed to accept ride" 
        });
      }
    });

    socket.on("ride:reject", async (data, ack) => {
      try {
        console.log(`❌ Driver ${socket.data.driverId} rejecting ride:`, data.bookingId);
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          { 
            $push: {
              cancelledByDrivers: { 
                driverId: socket.data.driverId,
                cancelledAt: new Date() 
              } 
            } 
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
        console.log(`📍 Driver ${socket.data.driverId} arrived for ride:`, data.bookingId);
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          { 
            rideStatus: RideBookStatusEnum.ARRIVED,
            "timestamps.arrivedAt": new Date() 
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
        console.log(`🔢 Driver ${socket.data.driverId} verifying OTP for ride:`, data.bookingId);
        const booking = await RideBookingDetail.findOne({ bookingId: data.bookingId });
        
        if (!booking) {
          return ack({ success: false, error: "Booking not found" });
        }

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

        if (isOtpValid) {
          io.to(booking.userId).emit("ride:otpVerified", { 
            bookingId: data.bookingId, 
            success: true 
          });
          ack({ success: true });
        } else {
          io.to(booking.userId).emit("ride:otpVerified", { 
            bookingId: data.bookingId, 
            success: false 
          });
          ack({ success: false, error: "Invalid OTP" });
        }
      } catch (err) {
        console.error("OTP verification error:", err);
        ack({ success: false, error: "Failed to verify OTP" });
      }
    });

    socket.on("ride:start", async (data, ack) => {
      try {
        console.log(`🏁 Driver ${socket.data.driverId} starting ride:`, data.bookingId);
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          { 
            rideStatus: RideBookStatusEnum.ON_RIDE,
            "timestamps.rideStartedAt": new Date() 
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
        console.log(`✅ Driver ${socket.data.driverId} completing ride:`, data.bookingId);
        await RideBookingDetail.findOneAndUpdate(
          { bookingId: data.bookingId },
          { 
            rideStatus: RideBookStatusEnum.COMPLETED,
            paymentStatus: PaymentStatusEnum.SUCCESS,
            "timestamps.completedAt": new Date() 
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
        console.log(`❌ Driver ${socket.data.driverId} cancelling ride:`, data.bookingId);
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
                cancelledAt: new Date() 
              }
            }
          },
          { new: true }
        );

        if (updated) {
          io.to(updated.userId).emit("ride:cancelled", { 
            bookingId: data.bookingId,
            reason: data.reason 
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

module.exports = { rideHandler };