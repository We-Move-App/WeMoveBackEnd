const DriverLocation = require("../../models/new-driver-module/location/driver-location.model");
const { LocationStatusEnum } = require("../../utils/constants/ENUM");

const driverLocationHandler = (socket, io) => {
  socket.on("driver:locationUpdate", async ({ lat, lng }, ack) => {
    const driverId = socket.data.driverId;

    if (!driverId || lat == null || lng == null) {
      return ack?.({ error: "Invalid location data" });
    }

    try {
      const updatedLocation = await DriverLocation.findOneAndUpdate(
        { driverId },
        {
          $set: {
            location: {
              type: "Point",
              coordinates: [lng, lat],
            },
            status: LocationStatusEnum.ONLINE,
          },
        },
        { upsert: true, new: true }
      );

      // Broadcast to all users for now (or restrict to nearby if optimized)
      io.of("/user").emit("driver:locationBroadcast", { driverId, lat, lng });

      ack?.({ message: "Location updated", location: updatedLocation.location });
    } catch (err) {
      console.error("❌ Error updating location:", err);
      ack?.({ error: "Failed to update location" });
    }
  });
};

module.exports = { driverLocationHandler };