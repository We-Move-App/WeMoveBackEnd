const DriverLocation = require('../../../models/new-driver-module/location/driver-location.model');
const { onlineDrivers } = require('./socketStore');

const logPrefix = '[📡 driverLocationHandler]';

const driverLocationHandler = (socket) => {
  const driver = socket.driver;

  if (!driver || driver.role !== 'driver') {
    console.warn(`${logPrefix} ⛔ Unauthorized socket connection attempt.`);
    return;
  }

  const driverId = driver._id.toString();
  const socketId = socket.id;

  // STEP 1: Store socketId in Map
  onlineDrivers.set(driverId, socketId);
  console.log(`${logPrefix} ✅ Driver ${driverId} connected on socket ${socketId}`);

  // STEP 2: Handle location updates
  socket.on('driver:locationUpdate', async (data, ack) => {
    const { lat, lng } = data?.location || {};

    if (lat == null || lng == null) {
      return ack?.({ error: 'Invalid location data' });
    }

    try {
      await DriverLocation.findOneAndUpdate(
        { driverId },
        {
          location: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          socketId,
          status: 'ONLINE',
        },
        { upsert: true, new: true }
      );

      console.log(`${logPrefix} 📍 Updated location for driver ${driverId}: [${lat}, ${lng}]`);
      ack?.({ message: 'Location updated' });
    } catch (err) {
      console.error(`${logPrefix} ❌ Error updating location`, err);
      ack?.({ error: 'Failed to update location' });
    }
  });

  // STEP 3: Handle disconnect
  socket.on('disconnect', async () => {
    onlineDrivers.delete(driverId);

    await DriverLocation.findOneAndUpdate(
      { driverId },
      {
        status: 'OFFLINE',
        socketId: null,
      }
    );

    console.log(`${logPrefix} ❌ Driver ${driverId} disconnected from socket ${socketId}`);
  });
};

module.exports = {
  driverLocationHandler,
};
