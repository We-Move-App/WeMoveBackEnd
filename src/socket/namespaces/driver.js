const { driverLocationHandler } = require("../handlers/locationHandler");
const { rideHandler } = require("../handlers/rideHandler");
const {chatHandler}=require('../handlers/chatHandler')

const jwt = require('jsonwebtoken');

const setupDriverNamespace = (driverNamespace, io) => {
  driverNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'Driver') {
        return next(new Error('Unauthorized'));
      }
      socket.data.driverId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  driverNamespace.on("connection", (socket) => {
    const { driverId } = socket.handshake.auth || {};

    if (!driverId) {
      socket.disconnect(true);
      return;
    }

    socket.data.driverId = driverId;
    console.log("🚗 Driver connected:", driverId);

    driverLocationHandler(socket, io);
    chatHandler(socket, io);
    rideHandler(socket, io, "Driver");

    socket.on("disconnect", () => {
      console.log("❌ Driver disconnected:", driverId);
    });
  });
};

module.exports = { setupDriverNamespace };