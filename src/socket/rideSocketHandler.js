const geolib = require("geolib");
const RideModel = require("../models/user-module/user-rides/user-ride.model");


const handleRideEvents = (socket, io, onDutyCaptains) => {
  
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
          .filter((captain) => captain.distance <= 10000) // 60 km radius
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
              message: `The ride with customer ${socket.user.id} has been canceled.`,
            });
          } else {
            console.log(`Captain not found for ride ${rideId}`);
          }
        } else {
          console.log(`No captain associated with ride ${rideId}`);
        }

        console.log(`Customer ${socket.user.id} canceled the ride ${rideId}`);
      });
    } catch (error) {
      console.error("Error searching for captain:", error);
      socket.emit("error", { message: "Error searching for captain" });
    }
  });

  socket.on("subscribeRide", async (rideId) => {
    socket.join(`ride_${rideId}`);
    try {
      const rideData = await RideModel.findById(rideId).populate(
        "user driver"
      );
      socket.emit("rideData", rideData);
    } catch (error) {
      socket.emit("error", "Failed to receive ride data");
    }
  });

  function getCaptainSocket(captainId) {
    const captain = Object.values(onDutyCaptains).find(
      (captain) => captain.userId.toString() === captainId.toString()
    );
    return captain ? io.sockets.sockets.get(captain.socketId) : null;
  }
};

module.exports = handleRideEvents;
