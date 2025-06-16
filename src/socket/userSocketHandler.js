const geolib = require("geolib");
const RideModel = require("../models/user-module/user-rides/user-ride.model");
const { getCaptainSocket } = require("./socketUtils");

let totalRadius = 60000; // 60 km
const handleUserEvents = (socket, io, onDutyCaptains) => {
  // Working fine
  socket.on("subscribeToZone", (customerCoords) => {
    console.log("User subscribed to zone:", customerCoords);

    if (
      !customerCoords ||
      typeof customerCoords.latitude !== "number" ||
      typeof customerCoords.longitude !== "number"
    ) {
      console.error("Invalid customer coordinates received.");
      return;
    }

    if (!socket.user) {
      console.error("User data is missing on socket connection.");
      return;
    }

    socket.user.coords = customerCoords;

    console.log("Current On-Duty Captains:", onDutyCaptains); // Debugging

    const nearbyCaptains = Object.values(onDutyCaptains)
      .filter(
        (captain) =>
          captain.coords &&
          geolib.isPointWithinRadius(captain.coords, customerCoords, 5000) // Reduced radius for better results
      )
      .map((captain) => ({
        id: captain.socketId,
        coords: captain.coords,
      }));
    socket.emit("nearbyCaptains", nearbyCaptains);
    console.log("Nearby Captains sent to User:", nearbyCaptains);
  });

  // SEARCH CAPTAIN
  socket.on("searchCaptain", async (rideId) => {
    try {
      const ride = await RideModel.findById(rideId).populate("user driver");
      if (!ride) {
        socket.emit("error", { message: "Ride not found" });
        return;
      }

      const { latitude: pickupLat, longitude: pickupLon } = ride.pickup;

      const findNearbyCaptains = () => {
        return Object.values(onDutyCaptains)
          .map((captain) => ({
            ...captain,
            distance: geolib.getDistance(captain.coords, {
              latitude: pickupLat,
              longitude: pickupLon,
            }),
          }))
          .filter((captain) => captain.distance <= totalRadius)
          .sort((a, b) => a.distance - b.distance);
      };

      const emitNearbyCaptains = () => {
        const nearbyCaptains = findNearbyCaptains();
        if (nearbyCaptains.length > 0) {
          socket.emit("nearbyCaptains", nearbyCaptains);
          nearbyCaptains.forEach((captain) => {
            socket.to(captain.socketId).emit("rideOffer", ride);
          });
        } else {
          console.log("No captains nearby, retrying...");
        }
        return nearbyCaptains;
      };

      const MAX_RETRIES = 20;
      let retries = 0;
      let rideAccepted = false;
      let canceled = false;

      const retrySearch = async () => {
        retries++;
        if (canceled) return;

        const captains = emitNearbyCaptains();
        if (captains.length > 0 || retries >= MAX_RETRIES) {
          clearInterval(retryInterval);

          if (!rideAccepted && retries >= MAX_RETRIES) {
            await RideModel.findByIdAndDelete(rideId);
            socket.emit("error", {
              message: "No captains found for your ride within 5 minutes.",
            });
          }
        }
      };

      const retryInterval = setInterval(retrySearch, 10000);

      socket.on("rideAccepted", async () => {
        rideAccepted = true;
        clearInterval(retryInterval);
      });

      socket.on("cancelRide", async () => {
        canceled = true;
        clearInterval(retryInterval);

        await RideModel.findByIdAndDelete(rideId);
        socket.emit("rideCanceled", {
          message: "Your ride has been canceled",
        });

        if (ride.captain) {
          const captainSocket = getCaptainSocket(ride.captain._id);
          if (captainSocket) {
            captainSocket.emit("rideCanceled", {
              message: `The ride with customer ${user.id} has been canceled.`,
            });
          } else {
            console.log(`Captain not found for ride ${rideId}`);
          }
        } else {
          console.log(`No captain associated with ride ${rideId}`);
        }

        console.log(`Customer ${user.id} canceled the ride ${rideId}`);
      });
    } catch (error) {
      console.error("Error searching for captain:", error);
      socket.emit("error", { message: "Error searching for captain" });
    }
  });

  // Subscribe to captain's location updates
  socket.on("subscribeToCaptainLocation", (captainId) => {
    const captain = onDutyCaptains[captainId];
    console.log(onDutyCaptains, captain);
    if (captain) {
      socket.join(`captain_${captainId}`);
      socket.emit("captainLocationUpdate", {
        captainId,
        coords: captain.coords,
      });
      console.log(
        `User ${user.id} subscribed to Captain ${captainId}'s location.`
      );
    }
  });

  socket.on("subscribeRide", async (rideId) => {
    socket.join(`ride_${rideId}`);
    try {
      const rideData =
        await RideModel.findById(rideId).populate("user driver");
      socket.emit("rideData", rideData);
    } catch (error) {
      socket.error("Failed to receive data");
    }
  });
};

module.exports = { handleUserEvents };
