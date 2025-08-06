// socket/index.js
const { driverLocationHandler } = require("./handlers/locationHandler");
const rideHandlers = require("./handlers/rideHandler"); // Changed import
const jwt = require("jsonwebtoken");

let ioInstance = null;

const initializeSocket = (io) => {
  ioInstance = io;
  // Main connection handler
  io.on("connection", (socket) => {
    const { token } = socket.handshake.auth;

    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      // Store role and IDs in socket data
      socket.data.role = decoded.role;

      if (decoded.role === "Driver") {
        socket.data.driverId = decoded.driverId;
        driverLocationHandler(socket, io);
        rideHandlers.rideHandler(socket, io, "driver"); // Changed to use the exported object

        console.log(`🚕 Driver connected: ${socket.data.driverId}`);
      } else if (decoded.role === "user") {
        socket.data.userId = decoded.userId || decoded._id;
        socket.join(socket.data.userId);
        rideHandlers.rideHandler(socket, io, "user"); // Changed to use the exported object

        console.log(`👤 User connected: ${socket.data.userId}`);
      }

      socket.on("disconnect", () => {
        if (socket.data.role === "Driver") {
          console.log(`🚕 Driver disconnected: ${socket.data.driverId}`);
        } else if (socket.data.role === "user") {
          console.log(`👤 User disconnected: ${socket.data.userId}`);
        }
      });
    } catch (err) {
      console.error("Authentication error:", err);
      socket.disconnect(true);
    }
  });
};

const getIO = () => {
  if (!ioInstance) throw new Error("Socket.IO not initialized");
  return ioInstance;
};

module.exports = { initializeSocket, getIO };