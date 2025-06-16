const geolib = require("geolib");
const { updateNearbyCaptains } = require("./socketUtils");

const handleDriverEvents = (socket, io, onDutyCaptains) => {

  if (!socket.user || !socket.user.id) {
    console.error("User data is missing on socket connection.");
    return;
  }

  const user = socket.user;

  const isValidCoords = (coords) =>
    coords &&
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number";

  // EVENT : goOnDuty
  socket.on("goOnDuty", (coords) => {
    if (!isValidCoords(coords)) {
      console.error("Invalid coordinates received for goOnDuty.");
      return;
    }

    onDutyCaptains[user.id] = { socketId: socket.id, coords };
    socket.join("onDuty");
    console.log(`Captain ${user.id} is now on duty.🫡`);
    updateNearbyCaptains(io, onDutyCaptains);
    console.log("onDuty Captains", onDutyCaptains);
  });

  // EVENT : goOffDuty
  socket.on("goOffDuty", () => {
    delete onDutyCaptains[user.id];
    socket.leave("onDuty");
    console.log(`Captain ${user.id} is now off duty.😪`);
    updateNearbyCaptains(io, onDutyCaptains);
    console.log("onDuty Captains", onDutyCaptains);
  });

  // EVENT : updateLocation
  socket.on("updateLocation", (coords) => {
    if (!isValidCoords(coords)) {
      console.error("Invalid coordinates received for updateLocation.");
      return;
    }

    if (onDutyCaptains[user.id]) {
      onDutyCaptains[user.id].coords = coords;
      console.log(`Captain ${user.id} updated location.`);
      updateNearbyCaptains(io, onDutyCaptains);

      // Notify customers subscribed to this captain
      socket.to(`captain_${user.id}`).emit("captainLocationUpdate", {
        captainId: user.id,
        coords,
      });
    }
    console.log("onDuty Captains", onDutyCaptains);
  });

  socket.on("disconnect", () => {
    if (user?.id) {
      delete onDutyCaptains[user.id];
    }
  });
};

// function updateNearbyCaptains(io) {
//   console.log("tiggered")
//   io.sockets.sockets.forEach((socket) => {
//     if (socket.user?.role && socket.user.role === "driver") {
//       console.log("Checking for user:", socket.id);

//       const customerCoords = socket.user?.coords;
//       if (customerCoords) {
//         const nearbyCaptains = Object.values(onDutyCaptains)
//           .filter((captain) =>
//             captain.coords &&
//             geolib.isPointWithinRadius(captain.coords, customerCoords, 60000)
//           )
//           .map((captain) => ({
//             id: captain.socketId,
//             coords: captain.coords,
//           }));

//         console.log("Sending nearby captains to:", socket.id);
//         socket.emit("nearbyCaptains", nearbyCaptains);
//       }
//     }
//   });
// }

module.exports = { handleDriverEvents };
