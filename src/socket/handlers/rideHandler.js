const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");
const getDistanceAndDuration = require("../../utils/map/getDistanceAndDuration");
const { RideBookStatusEnum } = require("../../utils/constants/ENUM");

const rideHandler = (socket, io, role) => {
  if (role === "user") {
    socket.on("ride:request", async (payload, ack) => {
      try {
        const {
          userId,
          driverId,
          bookingId,
          pickupLocation,
          dropLocation,
          fare,
        } = payload;

        console.log("📦 Incoming ride request payload:", payload);
        console.log("➡️ pickupLocation:", pickupLocation);
        console.log("➡️ dropLocation:", dropLocation);

        // Extract coordinates in [lng, lat] for MongoDB
        const pickupCoords = pickupLocation?.location?.coordinates || [
          pickupLocation.lng,
          pickupLocation.lat,
        ];
        const dropCoords = dropLocation?.location?.coordinates || [
          dropLocation.lng,
          dropLocation.lat,
        ];

        const pickup = {
          lat: pickupCoords[1],
          lng: pickupCoords[0],
        };
        const drop = {
          lat: dropCoords[1],
          lng: dropCoords[0],
        };

        // Validate
        if (
          typeof pickup.lat !== "number" ||
          typeof pickup.lng !== "number" ||
          typeof drop.lat !== "number" ||
          typeof drop.lng !== "number"
        ) {
          throw new Error("Coordinates are not in expected format.");
        }

        // Fetch from Google Maps
        const { distanceInKm, durationInMin } = await getDistanceAndDuration(
          pickup,
          drop
        );

        // Format pickup/drop with GeoJSON
        const formattedPickupLocation = {
          address: pickupLocation.address,
          location: {
            type: "Point",
            coordinates: [pickup.lng, pickup.lat],
          },
        };

        const formattedDropLocation = {
          address: dropLocation.address,
          location: {
            type: "Point",
            coordinates: [drop.lng, drop.lat],
          },
        };

        console.log("Creating ride with:", {
          driverId,
          userId,
          bookingId,
          pickupLocation: formattedPickupLocation,
          dropLocation: formattedDropLocation,
          fare,
          distanceInKm,
          durationInMin,
        });

        const ride = await RideBookingDetail.create({
          driverId,
          userId,
          bookingId,
          pickupLocation: formattedPickupLocation,
          dropLocation: formattedDropLocation,
          fare,
          distanceInKm,
          durationInMin,
          rideStatus: RideBookStatusEnum.REQUESTED,
          timestamps: { requestedAt: new Date() },
        });

        ack({ message: "Ride requested", rideId: ride._id });
      } catch (err) {
        console.error("❌ Error requesting ride:", err);
        ack({ error: err.message || "Ride request failed" });
      }
    });
  }

  if (role === "driver") {
    socket.on("ride:accept", async ({ bookingId }, ack) => {
      const driverId = socket.data.driverId;
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId },
          {
            driverId,
            rideStatus: "ACCEPTED",
            "timestamps.acceptedAt": new Date(),
          }
        );

        io.of("/user").emit("ride:accepted", { bookingId, driverId });
        ack?.({ message: "Ride accepted" });
      } catch (err) {
        console.error("❌ Error accepting ride:", err);
        ack?.({ error: "Ride acceptance failed" });
      }
    });

    socket.on("ride:start", async ({ bookingId }, ack) => {
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId },
          {
            rideStatus: "ONRIDE",
            "timestamps.rideStartedAt": new Date(),
          }
        );
        io.of("/user").emit("ride:started", { bookingId });
        ack?.({ message: "Ride started" });
      } catch (err) {
        console.error("❌ Error starting ride:", err);
        ack?.({ error: "Failed to start ride" });
      }
    });

    socket.on("ride:complete", async ({ bookingId }, ack) => {
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId },
          {
            rideStatus: "COMPLETED",
            paymentStatus: "PAID",
            "timestamps.completedAt": new Date(),
          }
        );
        io.of("/user").emit("ride:completed", { bookingId });
        ack?.({ message: "Ride completed" });
      } catch (err) {
        console.error("❌ Error completing ride:", err);
        ack?.({ error: "Failed to complete ride" });
      }
    });

    socket.on("ride:cancel", async ({ bookingId, reason }, ack) => {
      const driverId = socket.data.driverId;
      try {
        await RideBookingDetail.findOneAndUpdate(
          { bookingId },
          {
            rideStatus: "CANCELLED",
            reasonToCancel: reason,
            cancelledBy: "DRIVER",
            "timestamps.cancelledAt": new Date(),
            $push: {
              cancelledByDrivers: { driverId },
            },
          }
        );
        io.of("/user").emit("ride:cancelled", { bookingId, reason });
        ack?.({ message: "Ride cancelled" });
      } catch (err) {
        console.error("❌ Error cancelling ride:", err);
        ack?.({ error: "Failed to cancel ride" });
      }
    });
  }
};

module.exports = { rideHandler };
