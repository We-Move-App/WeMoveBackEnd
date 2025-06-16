const geolib = require("geolib");

const updateNearbyCaptains = (io, onDutyCaptains) => {
  io.sockets.sockets.forEach((socket) => {
    if (socket.user?.role === "user") {
      const customerCoords = socket.user?.coords;
      if (customerCoords) {
        const nearbyCaptains = Object.values(onDutyCaptains)
          .filter((captain) =>
            geolib.isPointWithinRadius(captain.coords, customerCoords, 60000)
          )
          .map((captain) => ({
            id: captain.socketId,
            coords: captain.coords,
          }));
        console.log("nearbyCaptains", nearbyCaptains)
        socket.emit("nearbyCaptains", nearbyCaptains);
      }
    }
  });
};

const getCaptainSocket = (io, captainId) => {
  const captain = Object.values(io.sockets.sockets).find(
    (socket) => socket.user?.id.toString() === captainId.toString()
  );
  return captain || null;
};

module.exports = { updateNearbyCaptains, getCaptainSocket };
