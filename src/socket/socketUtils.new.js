const geolib = require("geolib");

/**
 * Updates nearby captains for all connected users
 * @param {Object} io - Socket.io instance
 * @param {Object} onDutyCaptains - Object containing all on-duty captains
 */
const updateNearbyCaptains = (io, onDutyCaptains) => {
  console.log(`Updating nearby captains for all users. Total on-duty captains: ${Object.keys(onDutyCaptains).length}`);
  
  io.sockets.sockets.forEach((socket) => {
    if (socket.user?.role === "user" && socket.user?.coords) {
      const customerCoords = socket.user.coords;
      
      const nearbyCaptains = Object.values(onDutyCaptains)
        .filter((captain) =>
          captain.coords && 
          geolib.isPointWithinRadius(captain.coords, customerCoords, 60000) // 60km radius
        )
        .map((captain) => ({
          id: captain.socketId,
          coords: captain.coords,
          userId: captain.userId,
          distance: geolib.getDistance(captain.coords, customerCoords)
        }))
        .sort((a, b) => a.distance - b.distance);
      
      console.log(`Found ${nearbyCaptains.length} nearby captains for user ${socket.user.id}`);
      socket.emit("nearbyCaptains", nearbyCaptains);
    }
  });
};

/**
 * Gets the socket for a specific captain
 * @param {Object} io - Socket.io instance
 * @param {String} captainId - ID of the captain to find
 * @returns {Object|null} - Socket object or null if not found
 */
const getCaptainSocket = (io, captainId) => {
  for (const [socketId, socket] of io.sockets.sockets.entries()) {
    if (socket.user?.id && socket.user.id.toString() === captainId.toString()) {
      return socket;
    }
  }
  return null;
};

/**
 * Gets the socket for a specific user
 * @param {Object} io - Socket.io instance
 * @param {String} userId - ID of the user to find
 * @returns {Object|null} - Socket object or null if not found
 */
const getUserSocket = (io, userId) => {
  for (const [socketId, socket] of io.sockets.sockets.entries()) {
    if (socket.user?.id && socket.user.id.toString() === userId.toString()) {
      return socket;
    }
  }
  return null;
};

module.exports = { 
  updateNearbyCaptains, 
  getCaptainSocket,
  getUserSocket
};