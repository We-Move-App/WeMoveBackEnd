const geolib = require("geolib");

const handleUserEvents = (socket, io, onDutyCaptains) => {
  if (!socket.user || !socket.user.id) {
    console.error("User data is missing on socket connection.");
    return;
  }
  
  const user = socket.user;
  
  socket.on("subscribeToZone", (customerCoords) => {
    console.log(`User ${user.id} subscribed to zone:`, customerCoords);

    if (
      !customerCoords ||
      typeof customerCoords.latitude !== "number" ||
      typeof customerCoords.longitude !== "number"
    ) {
      console.error(`Invalid customer coordinates received from user ${user.id}.`);
      socket.emit("error", { message: "Invalid coordinates" });
      return;
    }

    // Store coordinates on the socket for later use
    socket.user.coords = customerCoords;

    // Find nearby captains within 5km radius
    console.log("Nearby Captains:", onDutyCaptains);
    const nearbyCaptains = Object.values(onDutyCaptains)
      .filter(
        (captain) =>
          captain.coords &&
          geolib.isPointWithinRadius(captain.coords, customerCoords, 5000)
      )
      .map((captain) => ({
        id: captain.socketId,
        coords: captain.coords,
      }));

    socket.emit("nearbyCaptains", nearbyCaptains);
    console.log(`Sent ${nearbyCaptains.length} nearby captains to user ${user.id}`);
  });

  // Subscribe to captain's location updates
  socket.on("subscribeToCaptainLocation", (captainId) => {
    console.log("in subToCapLoc", captainId, onDutyCaptains);
    
    const captain = onDutyCaptains[captainId.captainId];
    // console.log("targeted captain:", captain)
    if (captain) {
      socket.join(`captain_${captainId}`);
      
      // Send initial location
      socket.emit("locationUpdate", {
        captainId,
        coords: captain.coords,
      });
      // socket.emit("captainLocationUpdate", {
      //   captainId,
      //   coords: captain.coords,
      // });
      
      console.log(`User ${user.id} subscribed to Captain ${captain}'s location.`);
    } else {
      console.log(`User ${user.id} tried to subscribe to offline captain ${captainId}.`);
      socket.emit("error", { message: "Captain is not available" });
    }
  });

  // Unsubscribe from captain's location
  socket.on("unsubscribeFromCaptainLocation", (captainId) => {
    socket.leave(`captain_${captainId}`);
    console.log(`User ${user.id} unsubscribed from Captain ${captainId}'s location.`);
  });
  
  // Clean up on disconnect
  socket.on("disconnect", () => {
    console.log(`User ${user.id} disconnected`);
  });
};

module.exports = { handleUserEvents };