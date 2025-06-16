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

  // EVENT: goOnDuty
  socket.on("goOnDuty", (coords) => {
    if (!isValidCoords(coords)) {
      console.error(`Invalid coordinates received for goOnDuty from driver ${user.id}.`);
      socket.emit("error", { message: "Invalid coordinates" });
      return;
    }

    onDutyCaptains[user.id] = { 
      socketId: socket.id, 
      coords,
      userId: user.id  // Store user ID for lookup later
    };
    
    socket.join("onDuty");
    console.log(`Driver ${user.id} is now on duty at coordinates: ${JSON.stringify(coords)} 🫡`);
    updateNearbyCaptains(io, onDutyCaptains);
  });

  // EVENT: goOffDuty
  socket.on("goOffDuty", () => {
    delete onDutyCaptains[user.id];
    socket.leave("onDuty");
    console.log(`Driver ${user.id} is now off duty 😪`);
    updateNearbyCaptains(io, onDutyCaptains);
  });

  // EVENT: updateLocation
  socket.on("updateLocation", (coords) => {
    if (!isValidCoords(coords)) {
      console.error(`Invalid coordinates received for updateLocation from driver ${user.id}.`);
      socket.emit("error", { message: "Invalid coordinates" });
      return;
    }

    if (onDutyCaptains[user.id]) {
      onDutyCaptains[user.id].coords = coords;
      
      // Notify customers subscribed to this driver
      socket.to(`captain_${user.id}`).emit("captainLocationUpdate", {
        captainId: user.id,
        coords,
      });
      
      // Update nearby captains for all users
      updateNearbyCaptains(io, onDutyCaptains);
    } else {
      console.log(`Driver ${user.id} tried to update location while off duty.`);
      socket.emit("error", { message: "You must be on duty to update location" });
    }
  });

  // Handle ride-related events
  socket.on("acceptRide", async (rideId) => {
    try {
      io.to(`ride_${rideId}`).emit("rideAccepted", {
        driverId: user.id,
        message: "A driver has accepted your ride"
      });
      
      console.log(`Driver ${user.id} accepted ride ${rideId}`);
    } catch (error) {
      console.error(`Error accepting ride: ${error}`);
      socket.emit("error", { message: "Failed to accept ride" });
    }
  });

  // Clean up on disconnect
  socket.on("disconnect", () => {
    if (user?.id && onDutyCaptains[user.id]) {
      delete onDutyCaptains[user.id];
      console.log(`Driver ${user.id} disconnected and removed from on-duty list`);
      updateNearbyCaptains(io, onDutyCaptains);
    }
  });
};

module.exports = { handleDriverEvents };