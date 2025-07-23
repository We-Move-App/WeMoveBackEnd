const { driverLocationHandler } = require("../handlers/locationHandler");
const { rideHandler } = require("../handlers/rideHandler");

const setupDriverNamespace = (driverNamespace, io) => {
  driverNamespace.on("connection", (socket) => {
    const { driverId } = socket.handshake.auth || {};

    if (!driverId) {
      socket.disconnect(true);
      return;
    }

    socket.data.driverId = driverId;
    console.log("🚗 Driver connected:", driverId);

    driverLocationHandler(socket, io);
    rideHandler(socket, io, "driver");

    socket.on("disconnect", () => {
      console.log("❌ Driver disconnected:", driverId);
    });
  });
};

module.exports = { setupDriverNamespace };